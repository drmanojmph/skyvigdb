from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash
from datetime import datetime
from sqlalchemy import text
import os

app = Flask(__name__)

# =========================
# DATABASE CONFIG
# =========================

database_url = os.getenv("DATABASE_URL", "sqlite:///training_cases.db")

if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# =========================
# CORS — FIXED FOR PUT/OPTIONS
# =========================

CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200


# =========================
# MODELS
# =========================

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)


class Case(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    current_step = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default="New")

    receipt_date = db.Column(db.String(20))
    reporter_name = db.Column(db.String(100))
    reporter_contact = db.Column(db.String(100))
    reporter_country = db.Column(db.String(50))
    product_name = db.Column(db.String(200))
    event_description = db.Column(db.Text)

    patient_initials = db.Column(db.String(10))
    patient_age = db.Column(db.Integer)
    patient_gender = db.Column(db.String(10))

    causality_assessment = db.Column(db.String(50))
    listedness = db.Column(db.String(20))
    medical_comments = db.Column(db.Text)

    completeness_check = db.Column(db.Boolean, default=False)
    consistency_check = db.Column(db.Boolean, default=False)
    regulatory_compliance = db.Column(db.Boolean, default=False)
    quality_comments = db.Column(db.Text)
    final_status = db.Column(db.String(20))

    def to_dict(self):
        return {
            "id": self.id,
            "caseNumber": self.id,
            "currentStep": self.current_step,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "receiptDate": self.receipt_date,
            "reporterName": self.reporter_name,
            "reporterContact": self.reporter_contact,
            "reporterCountry": self.reporter_country,
            "productName": self.product_name,
            "eventDescription": self.event_description,
        }


# =========================
# DATABASE INITIALIZATION
# =========================

def init_db():
    db.drop_all()
    db.create_all()

    user = User(
        username="triage1",
        password_hash=generate_password_hash("train123"),
        role="triage",
    )

    db.session.add(user)
    db.session.commit()


with app.app_context():
    init_db()


# =========================
# HEALTH CHECK
# =========================

@app.route("/api/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})


# =========================
# CASE ROUTES
# =========================

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
        data = request.get_json()

        case = Case(
            id="PV-" + str(int(datetime.now().timestamp())),
            current_step=2,
            status="Triage Complete",
            receipt_date=data.get("receiptDate"),
            reporter_name=data.get("reporterName"),
            reporter_contact=data.get("reporterContact"),
            reporter_country=data.get("reporterCountry"),
            product_name=data.get("productName"),
            event_description=data.get("eventDescription"),
        )

        db.session.add(case)
        db.session.commit()

        return jsonify(case.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route("/api/cases/<case_id>", methods=["PUT"])
def update_case(case_id):
    try:
        case = Case.query.get_or_404(case_id)
        data = request.get_json()

        if case.current_step == 2:
            case.patient_initials = data.get("patientInitials")
            case.patient_age = data.get("patientAge")
            case.patient_gender = data.get("patientGender")
            case.current_step = 3
            case.status = "Data Entry Complete"

        elif case.current_step == 3:
            case.causality_assessment = data.get("causalityAssessment")
            case.listedness = data.get("listedness")
            case.medical_comments = data.get("medicalComments")
            case.current_step = 4
            case.status = "Medical Review Complete"

        elif case.current_step == 4:
            case.final_status = data.get("finalStatus")

            if data.get("finalStatus") == "approved":
                case.current_step = 5
                case.status = "Approved"
            else:
                case.current_step = 3
                case.status = "Rejected - Back to Medical"

        db.session.commit()
        return jsonify(case.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# =========================
# LOCAL RUN
# =========================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
