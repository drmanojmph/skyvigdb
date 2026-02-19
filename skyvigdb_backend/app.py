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


# ================= MODEL =================

class Case(db.Model):

    id = db.Column(db.String, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    current_step = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default="Triage")

    triage = db.Column(db.JSON)
    general = db.Column(db.JSON)
    patient = db.Column(db.JSON)
    products = db.Column(db.JSON)
    events = db.Column(db.JSON)
    medical = db.Column(db.JSON)
    quality = db.Column(db.JSON)
    narrative = db.Column(db.Text)

    def to_dict(self):

        return {
            "id": self.id,
            "caseNumber": self.id,
            "currentStep": self.current_step,
            "status": self.status,
            "triage": self.triage or {},
            "general": self.general or {},
            "patient": self.patient or {},
            "products": self.products or [],
            "events": self.events or [],
            "medical": self.medical or {},
            "quality": self.quality or {},
            "narrative": self.narrative or ""
        }


# ================= SAFE INIT =================

def init_db():

    with app.app_context():

        try:
            # Try simple query
            Case.query.first()

        except Exception:

            # Schema mismatch → reset table
            print("Resetting database schema")

            db.drop_all()
            db.create_all()

        else:
            db.create_all()


init_db()


# ================= ROUTES =================

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/cases", methods=["GET"])
def get_cases():

    try:
        cases = Case.query.all()
        return jsonify([c.to_dict() for c in cases])

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cases", methods=["POST"])
def create_case():

    try:

        data = request.json or {}

        case = Case(
            id="PV-" + str(int(datetime.utcnow().timestamp())),
            current_step=2,
            status="Data Entry",
            triage=data.get("triage", {}),
            general=data.get("general", {}),
            patient=data.get("patient", {}),
            products=data.get("products", []),
            events=data.get("events", [])
        )

        db.session.add(case)
        db.session.commit()

        return jsonify(case.to_dict())

    except Exception as e:

        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/cases/<case_id>", methods=["PUT"])
def update_case(case_id):

    try:

        case = Case.query.get_or_404(case_id)
        data = request.json or {}

        step = case.current_step

        if step == 2:

            case.general = data.get("general", {})
            case.patient = data.get("patient", {})
            case.products = data.get("products", [])
            case.events = data.get("events", [])

            case.current_step = 3
            case.status = "Medical"

        elif step == 3:

            case.medical = data.get("medical", {})
            case.narrative = data.get("narrative", "")

            case.current_step = 4
            case.status = "Quality"

        elif step == 4:

            case.quality = data.get("quality", {})

            if data.get("quality", {}).get("finalStatus") == "approved":

                case.current_step = 5
                case.status = "Approved"

            else:

                case.current_step = 3
                case.status = "Returned"

        db.session.commit()

        return jsonify(case.to_dict())

    except Exception as e:

        db.session.rollback()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run()
