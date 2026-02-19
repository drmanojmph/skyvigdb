from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)

db_url = os.getenv("DATABASE_URL", "sqlite:///local.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})


# ==================== MODEL ====================

class Case(db.Model):
    id          = db.Column(db.String,  primary_key=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_step = db.Column(db.Integer, default=1)
    status       = db.Column(db.String(50), default="Triage")

    triage    = db.Column(db.JSON)
    general   = db.Column(db.JSON)
    patient   = db.Column(db.JSON)
    products  = db.Column(db.JSON)
    events    = db.Column(db.JSON)
    medical   = db.Column(db.JSON)
    quality   = db.Column(db.JSON)
    narrative = db.Column(db.Text)

    def to_dict(self):
        return {
            "id":          self.id,
            "caseNumber":  self.id,
            "currentStep": self.current_step,
            "status":      self.status,
            "createdAt":   self.created_at.isoformat() if self.created_at else None,
            "updatedAt":   self.updated_at.isoformat() if self.updated_at else None,
            "triage":      self.triage    or {},
            "general":     self.general   or {},
            "patient":     self.patient   or {},
            "products":    self.products  or [],
            "events":      self.events    or [],
            "medical":     self.medical   or {},
            "quality":     self.quality   or {},
            "narrative":   self.narrative or ""
        }


# ==================== DB INIT ====================

def init_db():
    with app.app_context():
        try:
            Case.query.first()
        except Exception:
            print("[SkyVigilance] Schema mismatch — resetting tables.")
            db.drop_all()
            db.create_all()
        else:
            db.create_all()

init_db()


# ==================== ROUTES ====================

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


# ---------- List all cases ----------
@app.route("/api/cases", methods=["GET"])
def get_cases():
    try:
        cases = Case.query.order_by(Case.created_at.desc()).all()
        return jsonify([c.to_dict() for c in cases])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- Create case (Triage → step 2) ----------
@app.route("/api/cases", methods=["POST"])
def create_case():
    try:
        data = request.json or {}

        # Basic validation
        if not data.get("triage"):
            return jsonify({"error": "triage data is required"}), 400

        case_id = "PV-" + str(int(datetime.utcnow().timestamp()))

        case = Case(
            id           = case_id,
            current_step = 2,          # Moves to Data Entry queue
            status       = "Data Entry",
            triage       = data.get("triage",   {}),
            general      = data.get("general",  {}),
            patient      = data.get("patient",  {}),
            products     = data.get("products", []),
            events       = data.get("events",   [])
        )

        db.session.add(case)
        db.session.commit()

        return jsonify(case.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------- Update case (role-aware step transitions) ----------
@app.route("/api/cases/<case_id>", methods=["PUT"])
def update_case(case_id):
    try:
        case = Case.query.get(case_id)

        if case is None:
            return jsonify({"error": "Case not found"}), 404

        data = request.json or {}
        step = case.current_step

        # ---------- Step 2: Data Entry → Medical ----------
        if step == 2:
            case.general  = data.get("general",  case.general  or {})
            case.patient  = data.get("patient",  case.patient  or {})
            case.products = data.get("products", case.products or [])
            case.events   = data.get("events",   case.events   or [])

            case.current_step = 3
            case.status       = "Medical"

        # ---------- Step 3: Medical → Quality ----------
        elif step == 3:
            case.medical   = data.get("medical",   case.medical or {})
            case.narrative = data.get("narrative", case.narrative or "")

            # Keep events updated (MedDRA coding may have changed)
            if data.get("events"):
                case.events = data.get("events")

            case.current_step = 4
            case.status       = "Quality"

        # ---------- Step 4: Quality → Approved or Returned ----------
        elif step == 4:
            quality = data.get("quality", {})
            case.quality = quality

            final = quality.get("finalStatus", "").lower()

            if final == "approved":
                case.current_step = 5
                case.status       = "Approved"

            elif final == "returned":
                case.current_step = 3
                case.status       = "Returned to Medical"

            else:
                return jsonify({"error": "finalStatus must be 'approved' or 'returned'"}), 400

        # ---------- Step 5: already closed ----------
        elif step == 5:
            return jsonify({"error": "Case is already approved and closed."}), 400

        else:
            return jsonify({"error": f"Unexpected step: {step}"}), 400

        case.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(case.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------- Get single case ----------
@app.route("/api/cases/<case_id>", methods=["GET"])
def get_case(case_id):
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404
        return jsonify(case.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- Delete case (admin use in training) ----------
@app.route("/api/cases/<case_id>", methods=["DELETE"])
def delete_case(case_id):
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404
        db.session.delete(case)
        db.session.commit()
        return jsonify({"deleted": case_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
