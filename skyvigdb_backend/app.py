from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from sqlalchemy import text
from datetime import datetime
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

# ================= AUTO REPAIR =================

def repair_database():

    with app.app_context():

        try:
            # test query
            db.session.execute(text("SELECT triage FROM cases LIMIT 1"))

        except Exception:

            print("⚠️ Database schema mismatch detected. Repairing...")

            try:
                db.session.execute(text('DROP TABLE IF EXISTS "case"'))
                db.session.execute(text('DROP TABLE IF EXISTS cases'))
                db.session.commit()
            except Exception:
                db.session.rollback()

            db.create_all()
            print("✅ Database repaired")


repair_database()

# ================= HEALTH =================

@app.route("/api/health")
def health():

    try:
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ================= CASE ROUTES =================

@app.route("/api/cases", methods=["GET"])
def get_cases():

    cases = Case.query.all()
    return jsonify([c.to_dict() for c in cases])


@app.route("/api/cases", methods=["POST"])
def create_case():

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


@app.route("/api/cases/<case_id>", methods=["PUT"])
def update_case(case_id):

    case = Case.query.get_or_404(case_id)
    data = request.json or {}

    step = case.current_step

    if step == 2:
        case.data_entry = data
        case.current_step = 3
        case.status = "Data Entry Complete"

    elif step == 3:
        case.medical = data
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
