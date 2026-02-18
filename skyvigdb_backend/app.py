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

CORS(app, resources={r"/api/*": {"origins": "*"}})

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
    # For training/demo: reset schema each deploy to avoid column mismatch
    db.drop_all()
    db.create_all()

    # Seed default user
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
# ROUTES
# =========================

@app.route("/api/health")
def health():
    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)})


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


# =========================
# LOCAL RUN
# =========================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
