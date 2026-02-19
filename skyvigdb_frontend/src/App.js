from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)

db_url = os.getenv("DATABASE_URL", "sqlite:///local.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"]     = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})


# =========================================================
# MODEL
# =========================================================

class Case(db.Model):
    """
    Mirrors the Oracle Argus Safety case form sections:
      - triage    : Initial case entry / book-in fields
      - general   : General tab (source, report type, seriousness, reporter sub-object)
      - patient   : Patient tab (demographics, history, lab data sub-arrays)
      - products  : Products tab (drug/device/vaccine list)
      - events    : Events tab (AE list with MedDRA coding)
      - medical   : Medical review (causality, listedness, narrative)
      - quality   : Quality review (QC checklist, final status)
      - narrative : Full case narrative (also stored in medical for convenience)
    """

    id           = db.Column(db.String,   primary_key=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    current_step = db.Column(db.Integer,  default=1)
    status       = db.Column(db.String(100), default="Triage")

    # ---- Argus Case Form sections ----
    triage    = db.Column(db.JSON)   # Receipt date, COI, reporter, seriousness, product/event brief
    general   = db.Column(db.JSON)   # Source/report type, classifications, seriousness, reporter details
    patient   = db.Column(db.JSON)   # Demographics, history, lab data, pregnancy
    products  = db.Column(db.JSON)   # Array of product objects (drug/device/vaccine)
    events    = db.Column(db.JSON)   # Array of event objects with MedDRA coding
    medical   = db.Column(db.JSON)   # Causality, listedness, case analysis, algorithms
    quality   = db.Column(db.JSON)   # QC checklist, comments, final status
    narrative = db.Column(db.Text)   # Full case narrative

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


# =========================================================
# DB INIT (schema-safe)
# =========================================================

def init_db():
    with app.app_context():
        try:
            Case.query.first()
        except Exception:
            print("[SkyVigilance] Schema changed — dropping and recreating tables.")
            db.drop_all()
            db.create_all()
        else:
            db.create_all()

init_db()


# =========================================================
# HELPERS
# =========================================================

def _validate_step(data, step):
    """
    Lightweight field validation per workflow step.
    Returns (ok: bool, errors: list[str])
    """
    errors = []

    if step == 1:
        triage = data.get("triage", {})
        if not triage.get("receiptDate"):
            errors.append("Initial Receipt Date is required.")
        if not triage.get("country"):
            errors.append("Country of Incidence is required.")

    if step == 2:
        # At minimum a patient section should exist
        if not data.get("general") and not data.get("patient"):
            errors.append("At least General or Patient data is required for Data Entry.")

    if step == 3:
        medical = data.get("medical", {})
        if not medical.get("causality") and not medical.get("causalityReported"):
            errors.append("Causality assessment is recommended before submitting for Quality review.")

    if step == 4:
        quality = data.get("quality", {})
        if quality.get("finalStatus") not in ("approved", "returned"):
            errors.append("Final status must be 'approved' or 'returned'.")

    return len(errors) == 0, errors


# =========================================================
# ROUTES
# =========================================================

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "time":   datetime.utcnow().isoformat(),
        "db":     db_url.split("///")[-1].split("@")[-1]  # safe partial display
    })


# ---------- GET /api/cases — list all ----------
@app.route("/api/cases", methods=["GET"])
def get_cases():
    try:
        cases = Case.query.order_by(Case.created_at.desc()).all()
        return jsonify([c.to_dict() for c in cases])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- POST /api/cases — Triage book-in → step 2 ----------
@app.route("/api/cases", methods=["POST"])
def create_case():
    try:
        data = request.json or {}

        ok, errors = _validate_step(data, 1)
        if not ok:
            return jsonify({"error": "Validation failed", "details": errors}), 400

        case_id = "PV-" + str(int(datetime.utcnow().timestamp()))

        case = Case(
            id           = case_id,
            current_step = 2,
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


# ---------- GET /api/cases/<id> — get single ----------
@app.route("/api/cases/<case_id>", methods=["GET"])
def get_case(case_id):
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404
        return jsonify(case.to_dict())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- PUT /api/cases/<id> — role-aware step advancement ----------
@app.route("/api/cases/<case_id>", methods=["PUT"])
def update_case(case_id):
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404

        data = request.json or {}
        step = case.current_step

        # ---- Step 2: Data Entry → Medical Review ----
        if step == 2:
            case.general   = data.get("general",  case.general  or {})
            case.patient   = data.get("patient",  case.patient  or {})
            case.products  = data.get("products", case.products or [])
            case.events    = data.get("events",   case.events   or [])
            # Narrative authored in Data Entry — persist so Medical reviewer can read it
            if data.get("narrative") is not None:
                case.narrative = data.get("narrative")

            case.current_step = 3
            case.status       = "Medical Review"

        # ---- Step 3: Medical Review → Quality Review OR back to Data Entry ----
        elif step == 3:
            case.medical   = data.get("medical",   case.medical or {})
            case.narrative = data.get("narrative", case.narrative or "")

            if data.get("events"):
                case.events = data.get("events")

            # Medical reviewer may route the case back to Data Entry for more info
            route_back = bool((case.medical or {}).get("routeBackToDataEntry", False))
            if route_back:
                # Remove the flag so it doesn't persist for the next submission
                cleaned = {k: v for k, v in case.medical.items() if k != "routeBackToDataEntry"}
                case.medical = cleaned
                case.current_step = 2
                case.status       = "Returned to Data Entry"
            else:
                case.current_step = 4
                case.status       = "Quality Review"

        # ---- Step 4: Quality Review → Approved or Returned ----
        elif step == 4:
            quality = data.get("quality", {})
            ok, errors = _validate_step(data, 4)
            if not ok:
                return jsonify({"error": "Validation failed", "details": errors}), 400

            case.quality = quality
            final = quality.get("finalStatus", "").lower()

            if final == "approved":
                case.current_step = 5
                case.status       = "Approved"

            elif final == "returned":
                # Return to Medical Review for rework
                case.current_step = 3
                case.status       = "Returned to Medical"

        # ---- Step 5: Already closed ----
        elif step == 5:
            return jsonify({"error": "Case is approved and closed. No further updates permitted."}), 400

        else:
            return jsonify({"error": f"Unexpected case step: {step}"}), 400

        case.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(case.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------- DELETE /api/cases/<id> — training resets ----------
@app.route("/api/cases/<case_id>", methods=["DELETE"])
def delete_case(case_id):
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404
        db.session.delete(case)
        db.session.commit()
        return jsonify({"deleted": case_id, "message": "Case removed from training database."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------- DELETE /api/cases — clear all (training reset) ----------
@app.route("/api/cases", methods=["DELETE"])
def delete_all_cases():
    try:
        count = Case.query.delete()
        db.session.commit()
        return jsonify({"deleted": count, "message": f"{count} cases cleared from training database."})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------- GET /api/stats — quick training stats ----------
@app.route("/api/stats")
def get_stats():
    try:
        total    = Case.query.count()
        by_step  = {
            "Triage":             Case.query.filter_by(current_step=1).count(),
            "Data Entry":         Case.query.filter_by(current_step=2).count(),
            "Medical Review":     Case.query.filter_by(current_step=3).count(),
            "Quality Review":     Case.query.filter_by(current_step=4).count(),
            "Approved":           Case.query.filter_by(current_step=5).count(),
        }
        return jsonify({"total": total, "byStep": by_step})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
