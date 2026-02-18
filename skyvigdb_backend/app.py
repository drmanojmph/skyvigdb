from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import text
from datetime import datetime
import os
import xml.etree.ElementTree as ET
from io import BytesIO
from reportlab.platypus import SimpleDocTemplate, Table
from reportlab.lib.pagesizes import A4

app = Flask(__name__)

# ================= DATABASE =================

db_url = os.getenv("DATABASE_URL", "sqlite:///local.db")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

CORS(app, resources={r"/api/*": {"origins": "*"}})

# ================= MODEL =================

class Case(db.Model):

    __tablename__ = "cases"

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
            "triage": self.triage or {},
            "dataEntry": self.data_entry or {},
            "medical": self.medical or {},
            "quality": self.quality or {},
            "narrative": self.narrative
        }

# ================= INIT =================

def init_db():
    with app.app_context():
        db.create_all()

init_db()

# ================= HEALTH =================

@app.route("/api/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ================= MEDDRA MOCK =================

MEDDRA = [
    {"pt": "Headache", "soc": "Nervous system disorders"},
    {"pt": "Nausea", "soc": "Gastrointestinal disorders"},
    {"pt": "Rash", "soc": "Skin disorders"},
]

@app.route("/api/meddra")
def meddra():
    q = request.args.get("q", "").lower()
    results = [m for m in MEDDRA if q in m["pt"].lower()]
    return jsonify(results[:20])

# ================= CAUSALITY =================

def who_umc(data):

    if not data:
        return "Unassessable"

    time_rel = data.get("timeRelation")
    dechallenge = data.get("dechallenge")
    rechallenge = data.get("rechallenge")
    alt = data.get("alternativeCauses")

    if time_rel and rechallenge:
        return "Certain"
    if time_rel and dechallenge and not alt:
        return "Probable"
    if time_rel:
        return "Possible"
    if alt:
        return "Unlikely"

    return "Unassessable"


@app.route("/api/causality", methods=["POST"])
def causality():
    data = request.json or {}
    result = who_umc(data)
    return jsonify({"result": result})

# ================= NARRATIVE =================

def generate_narrative(case):

    try:
        triage = case.triage or {}
        de = case.data_entry or {}

        patient = de.get("patient", {})
        products = de.get("products", [])
        events = de.get("events", [])

        prod_names = ", ".join([p.get("name", "") for p in products])
        event_terms = ", ".join([e.get("term", "") for e in events])

        return (
            f"A {patient.get('age','')} year old "
            f"{patient.get('gender','')} patient experienced "
            f"{event_terms} after receiving {prod_names}. "
            f"Reported by {triage.get('reporterName','')}."
        )

    except Exception:
        return "Narrative unavailable."

# ================= CASE ROUTES =================

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
            status="Triage Complete",
            triage=data
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

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ================= CIOMS =================

@app.route("/api/cioms/<case_id>")
def cioms(case_id):

    case = Case.query.get_or_404(case_id)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)

    data = [
        ["CIOMS Report", case.id],
        ["Status", case.status],
        ["Narrative", case.narrative or ""]
    ]

    table = Table(data)
    doc.build([table])

    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{case.id}.pdf",
        mimetype="application/pdf"
    )

# ================= E2B =================

@app.route("/api/e2b/<case_id>")
def e2b(case_id):

    case = Case.query.get_or_404(case_id)

    root = ET.Element("SafetyReport")

    ET.SubElement(root, "CaseID").text = case.id
    ET.SubElement(root, "Status").text = case.status

    xml_data = ET.tostring(root)

    return app.response_class(xml_data, mimetype="application/xml")

# ================= DASHBOARD =================

@app.route("/api/dashboard")
def dashboard():

    total = Case.query.count()
    approved = Case.query.filter_by(status="Approved").count()

    return jsonify({
        "totalCases": total,
        "approvedCases": approved
    })


if __name__ == "__main__":
    app.run()
