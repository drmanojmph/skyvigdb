from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime
from sqlalchemy import text
import os

# ============================================================================
# APP INITIALIZATION
# ============================================================================

app = Flask(__name__)

# ============================================================================
# DATABASE CONFIGURATION — RENDER / POSTGRES READY
# ============================================================================

database_url = os.getenv("DATABASE_URL", "sqlite:///training_cases.db")

# Render sometimes provides postgres:// instead of postgresql://
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

# ============================================================================
# OTHER CONFIG
# ============================================================================

app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change")
app.config["SESSION_TYPE"] = "filesystem"
app.config["PERMANENT_SESSION_LIFETIME"] = 3600

db = SQLAlchemy(app)

CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "https://safetydb.skyvigilance.com",
                "https://skyvigdbfrontend.vercel.app",
                "http://localhost:3000",
            ],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type"],
        }
    },
)

# ============================================================================
# MODELS
# ============================================================================


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    full_name = db.Column(db.String(100))

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Case(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(50))

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
            "patientInitials": self.patient_initials,
            "causalityAssessment": self.causality_assessment,
            "listedness": self.listedness,
        }


class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.String(50), db.ForeignKey("case.id"), nullable=True)
    action = db.Column(db.String(50))
    user = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)


# ============================================================================
# INITIAL DATA
# ============================================================================


def init_training_data():
    training_users = [
        {
            "username": "triage1",
            "password": "train123",
            "role": "triage",
            "name": "Triage Trainee",
        },
        {
            "username": "dataentry1",
            "password": "train123",
            "role": "dataentry",
            "name": "Data Entry Trainee",
        },
        {
            "username": "medical1",
            "password": "train123",
            "role": "medical",
            "name": "Medical Reviewer Trainee",
        },
        {
            "username": "quality1",
            "password": "train123",
            "role": "quality",
            "name": "Quality Reviewer Trainee",
        },
    ]

    for u in training_users:
        if not User.query.filter_by(username=u["username"]).first():
            user = User(
                username=u["username"],
                password_hash=generate_password_hash(u["password"]),
                role=u["role"],
                full_name=u["name"],
            )
            db.session.add(user)

    db.session.commit()


# ============================================================================
# HEALTH CHECK
# ============================================================================


@app.route("/api/health", methods=["GET"])
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return jsonify(
        {
            "status": "ok",
            "database": db_status,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )


# ============================================================================
# CASE ROUTES
# ============================================================================


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

        case_id = "PV-" + str(int(datetime.now().timestamp()))

        case = Case(
            id=case_id,
            created_by="triage1",
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


@app.route("/api/cases/<case_id>", methods=["GET"])
def get_case(case_id):
    case = Case.query.get_or_404(case_id)
    return jsonify(case.to_dict())


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
            case.completeness_check = data.get("completenessCheck", False)
            case.consistency_check = data.get("consistencyCheck", False)
            case.regulatory_compliance = data.get("regulatoryCompliance", False)
            case.quality_comments = data.get("qualityComments")
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


# ============================================================================
# STARTUP INITIALIZATION — CRITICAL FOR RENDER
# ============================================================================

with app.app_context():
    db.create_all()
    init_training_data()


# ============================================================================
# LOCAL RUN
# ============================================================================

if __name__ == "__main__":
    app.run(debug=True, port=5000)
