from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
from sqlalchemy import text
import os

app = Flask(__name__)

# ================= DATABASE =================

db_url = os.getenv("DATABASE_URL", "sqlite:///local.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

CORS(app, resources={r"/api/*": {"origins": "*"}})

# ================= MODELS =================

class Case(db.Model):
    id = db.Column(db.String, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    current_step = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default="New")

    triage = db.Column(db.JSON)
    data_entry = db.Column(db.JSON)
    medical = db.Column(db.JSON)
    quality = db.Column(db.JSON)

    narrative = db.Column(db.Text)

    def to_dict(self):
        return {
            "id": self.id,
            "caseNumber": self.id,
            "currentStep": self.current_step,
            "status": self.status,
            "triage": self.triage,
            "dataEntry": self.data_entry,
            "medical": self.medical,
            "quality": self.quality,
            "narrative": self.narrative
        }

# ================= INIT =================

@app.before_request
def init():
    db.create_all()

# ================= UTIL =================

def generate_narrative(case):

    triage = case.triage or {}
    de = case.data_entry or {}

    patient = de.get("patient", {})
    products = de.get("products", [])
    events = de.get("events", [])

    product_names = ", ".join([p.get("name","") for p in products])
    event_terms = ", ".join([e.get("term","") for e in events])

    narrative = f"""
This case concerns a {patient.get('age','')} year old {patient.get('gender','')}
patient from {triage.get('country','')} who experienced {event_terms}
following administration of {product_names}.

The case was reported by {triage.get('reporterName','')}.
"""

    return narrative.strip()

# ================= ROUTES =================

@app.route("/api/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route("/api/cases", methods=["GET"])
def get_cases():
    cases = Case.query.all()
    return jsonify([c.to_dict() for c in cases])

@app.route("/api/cases", methods=["POST"])
def create_case():

    data = request.json

    case = Case(
        id="PV-" + str(int(datetime.utcnow().timestamp())),
        current_step=2,
        status="Triage Complete",
        triage=data
    )

    db.session.add(case)
    db.session.commit()

    return jsonify(case.to_dict())

@app.route("/api/cases/<case_id>", methods=["PUT"])
def update_case(case_id):

    case = Case.query.get_or_404(case_id)
    data = request.json

    step = case.current_step

    if step == 2:
        case.data_entry = data
        case.current_step = 3
        case.status = "Data Entry Complete"

    elif step == 3:
        case.medical = data
        case.narrative = generate_narrative(case)
        case.current_step = 4
        case.status = "Medical Review Complete"

    elif step == 4:
        case.quality = data

        if data.get("finalStatus") == "approved":
            case.current_step = 5
            case.status = "Approved"
        else:
            case.current_step = 3
            case.status = "Returned to Medical"

    db.session.commit()

    return jsonify(case.to_dict())

if __name__ == "__main__":
    app.run()
