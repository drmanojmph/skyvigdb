from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
from sqlalchemy import text
import os, json, xml.etree.ElementTree as ET
from io import BytesIO
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors

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

# ================= MEDDRA MOCK =================

MEDDRA = [
    {"pt": "Headache", "soc": "Nervous system disorders"},
    {"pt": "Nausea", "soc": "Gastrointestinal disorders"},
    {"pt": "Rash", "soc": "Skin disorders"},
]

@app.route("/api/meddra")
def meddra():
    q = request.args.get("q", "").lower()
    return jsonify([m for m in MEDDRA if q in m["pt"].lower()][:20])

# ================= CAUSALITY =================

def who_umc(data):

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
    result = who_umc(request.json)
    return jsonify({"result": result})

# ================= NARRATIVE =================

def generate_narrative(case):

    triage = case.triage or {}
    de = case.data_entry or {}

    patient = de.get("patient", {})
    products = de.get("products", [])
    events = de.get("events", [])

    prod_names = ", ".join([p.get("name","") for p in products])
    event_terms = ", ".join([e.get("term","") for e in events])

    return f"""
A {patient.get('age','')} year old {patient.get('gender','')} patient
experienced {event_terms} following administration of {prod_names}.
Reported by {triage.get('reporterName','')}.
""".strip()

# ================= HEALTH =================

@app.route("/api/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# ================= CASE ROUTES =================

@app.route("/api/cases", methods=["GET"])
def get_cases():
    return jsonify([c.to_dict() for c in Case.query.all()])


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

# ================= CIOMS PDF =================

@app.route("/api/cioms/<case_id>")
def cioms(case_id):

    case = Case.query.get_or_404(case_id)

    buffer = BytesIO()

    doc = SimpleDocTemplate(buffer, pagesize=A4)

    data = [
        ["CIOMS I FORM", case.id],
        ["Patient", str(case.data_entry.get("patient", ""))],
        ["Products", str(case.data_entry.get("products", ""))],
        ["Events", str(case.data_entry.get("events", ""))],
        ["Narrative", case.narrative or ""]
    ]

    table = Table(data, colWidths=[150, 350])

    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 1, colors.black),
        ("BACKGROUND", (0,0), (-1,0), colors.grey)
    ]))

    doc.build([table])

    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name=f"{case.id}_CIOMS.pdf",
        mimetype="application/pdf"
    )

# ================= E2B XML =================

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
