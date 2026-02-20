from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm.attributes import flag_modified
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)

# ------------------------------------------------------------------
# DATABASE — set DATABASE_URL in Render environment variables
# Neon.tech free PostgreSQL: postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
# Local dev fallback: sqlite:///local.db
# ------------------------------------------------------------------
db_url = os.getenv("DATABASE_URL", "sqlite:///local.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"]        = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"]      = {"pool_pre_ping": True}

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
# AUDIT LOG MODEL
# =========================================================

class AuditLog(db.Model):
    """
    GxP-style audit trail — every meaningful action on a case is recorded here.
    Mirrors the audit trail functionality of enterprise PV systems like Oracle Argus Safety.

    Each row captures:
      - who performed the action (username + role)
      - what action was taken (action_type)
      - when it happened (timestamp)
      - which case it affects (case_id)
      - workflow step transition (step_from → step_to)
      - a human-readable summary of what changed (details)
    """

    __tablename__ = "audit_log"

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    case_id      = db.Column(db.String, db.ForeignKey("case.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp    = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    action_type  = db.Column(db.String(60), nullable=False)   # e.g. CASE_CREATED, TAB_SAVED, SUBMITTED
    performed_by = db.Column(db.String(80), nullable=False)   # username
    role         = db.Column(db.String(40), nullable=False)   # Triage, Data Entry, Medical, Quality
    step_from    = db.Column(db.Integer, nullable=True)
    step_to      = db.Column(db.Integer, nullable=True)
    section      = db.Column(db.String(60), nullable=True)    # which tab was saved, if applicable
    details      = db.Column(db.Text,    nullable=True)       # human-readable summary

    def to_dict(self):
        return {
            "id":          self.id,
            "caseId":      self.case_id,
            "timestamp":   self.timestamp.isoformat() + "Z",
            "actionType":  self.action_type,
            "performedBy": self.performed_by,
            "role":        self.role,
            "stepFrom":    self.step_from,
            "stepTo":      self.step_to,
            "section":     self.section,
            "details":     self.details,
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
            # create_all is safe to call repeatedly — only creates missing tables
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
# AUDIT HELPER
# =========================================================

def log_event(case_id, action_type, performed_by, role,
              step_from=None, step_to=None, section=None, details=None):
    """
    Write one audit trail entry.
    Called from POST, PUT, and PATCH handlers.
    Never raises — audit failures must not break the main workflow.
    """
    try:
        entry = AuditLog(
            case_id      = case_id,
            action_type  = action_type,
            performed_by = performed_by,
            role         = role,
            step_from    = step_from,
            step_to      = step_to,
            section      = section,
            details      = details,
        )
        db.session.add(entry)
        # Note: caller is responsible for committing the session
    except Exception as e:
        print(f"[AUDIT] Failed to log event: {e}")


def extract_audit(data):
    """
    Pull _audit metadata out of the request body and return
    (performed_by, role, cleaned_data).
    The _audit key is never saved to the case.
    """
    audit = data.pop("_audit", {}) if isinstance(data, dict) else {}
    performed_by = audit.get("performedBy", "unknown")
    role         = audit.get("role",        "unknown")
    return performed_by, role, data


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
        performed_by, role, data = extract_audit(data)

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

        # ── Audit: case created ──
        log_event(
            case_id      = case_id,
            action_type  = "CASE_CREATED",
            performed_by = performed_by,
            role         = role,
            step_from    = None,
            step_to      = 2,
            section      = "triage",
            details      = (
                f"Case booked in by {performed_by} ({role}). "
                f"Patient: {data.get('triage',{}).get('patientInitials','—')} | "
                f"Drug: {(data.get('products') or [{}])[0].get('name','—')} | "
                f"Event: {(data.get('events') or [{}])[0].get('term','—')}"
            ),
        )

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
        performed_by, role, data = extract_audit(data)
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

            log_event(
                case_id      = case_id,
                action_type  = "SUBMITTED",
                performed_by = performed_by,
                role         = role,
                step_from    = 2,
                step_to      = 3,
                section      = "all_tabs",
                details      = (
                    f"{performed_by} ({role}) submitted case from Data Entry to Medical Review. "
                    f"Narrative: {'present' if data.get('narrative') else 'not yet entered'}."
                ),
            )

        # ---- Step 3: Medical Review → Quality Review OR back to Data Entry ----
        elif step == 3:
            # Read incoming medical dict into a local variable first.
            # Do NOT re-read case.medical after assignment — SQLAlchemy JSON columns
            # may return the old cached value within the same session, causing the
            # routeBackToDataEntry flag to be missed.
            incoming_medical = data.get("medical", case.medical or {})
            incoming_narrative = data.get("narrative", case.narrative or "")
            incoming_events    = data.get("events")

            # Check the routing flag BEFORE writing to case.medical
            route_back = bool(incoming_medical.get("routeBackToDataEntry", False))

            if route_back:
                # Strip the flag so it doesn't persist for future submissions
                case.medical = {k: v for k, v in incoming_medical.items()
                                if k != "routeBackToDataEntry"}
                case.current_step = 2
                case.status       = "Returned to Data Entry"

                log_event(
                    case_id      = case_id,
                    action_type  = "ROUTE_BACK_TO_DE",
                    performed_by = performed_by,
                    role         = role,
                    step_from    = 3,
                    step_to      = 2,
                    section      = "medical",
                    details      = (
                        f"{performed_by} ({role}) returned case to Data Entry for additional information. "
                        f"Causality at time of return: {incoming_medical.get('causality','not assessed')}."
                    ),
                )
            else:
                case.medical      = incoming_medical
                case.current_step = 4
                case.status       = "Quality Review"

                log_event(
                    case_id      = case_id,
                    action_type  = "SUBMITTED",
                    performed_by = performed_by,
                    role         = role,
                    step_from    = 3,
                    step_to      = 4,
                    section      = "medical",
                    details      = (
                        f"{performed_by} ({role}) submitted Medical Review to Quality Review. "
                        f"Causality: {incoming_medical.get('causality','—')} | "
                        f"WHO-UMC: {incoming_medical.get('whoUMC','—')} | "
                        f"Listedness: {incoming_medical.get('listedness','—')}."
                    ),
                )

            case.narrative = incoming_narrative
            if incoming_events:
                case.events = incoming_events

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

                log_event(
                    case_id      = case_id,
                    action_type  = "APPROVED",
                    performed_by = performed_by,
                    role         = role,
                    step_from    = 4,
                    step_to      = 5,
                    section      = "quality",
                    details      = (
                        f"{performed_by} ({role}) approved and closed the case. "
                        f"QC comments: {quality.get('comments','none')}."
                    ),
                )

            elif final == "returned":
                # Return to Medical Review for rework
                case.current_step = 3
                case.status       = "Returned to Medical"

                log_event(
                    case_id      = case_id,
                    action_type  = "RETURNED_TO_MEDICAL",
                    performed_by = performed_by,
                    role         = role,
                    step_from    = 4,
                    step_to      = 3,
                    section      = "quality",
                    details      = (
                        f"{performed_by} ({role}) returned case to Medical Review for rework. "
                        f"QC comments: {quality.get('comments','none')}."
                    ),
                )

        # ---- Step 5: Already closed ----
        elif step == 5:
            return jsonify({"error": "Case is approved and closed. No further updates permitted."}), 400

        else:
            return jsonify({"error": f"Unexpected case step: {step}"}), 400

        case.updated_at = datetime.utcnow()
        # Explicitly flag JSON columns as modified so SQLAlchemy detects all changes
        for col in ("triage", "general", "patient", "products", "events", "medical", "quality"):
            flag_modified(case, col)
        db.session.commit()

        return jsonify(case.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500



# ---------- PATCH /api/cases/<id> — partial save (no step advance) ----------
@app.route("/api/cases/<case_id>", methods=["PATCH"])
def patch_case(case_id):
    """
    Tab-level partial save.
    Persists any supplied fields without advancing current_step or changing status.
    Accepted fields: triage, general, patient, products, events, medical, narrative
    """
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404

        data = request.json or {}
        performed_by, role, data = extract_audit(data)

        # Determine which sections are being saved for the audit entry
        saved_sections = [s for s in ("triage","general","patient","products","events","medical","narrative") if s in data]

        if "triage"    in data: case.triage    = data["triage"]
        if "general"   in data: case.general   = data["general"]
        if "patient"   in data: case.patient   = data["patient"]
        if "products"  in data: case.products  = data["products"]
        if "events"    in data: case.events    = data["events"]
        if "medical"   in data: case.medical   = data["medical"]
        if "narrative" in data: case.narrative = data["narrative"]

        case.updated_at = datetime.utcnow()
        for col in ("triage", "general", "patient", "products", "events", "medical", "quality"):
            flag_modified(case, col)

        # ── Audit: tab saved ──
        log_event(
            case_id      = case_id,
            action_type  = "TAB_SAVED",
            performed_by = performed_by,
            role         = role,
            step_from    = case.current_step,
            step_to      = case.current_step,
            section      = ", ".join(saved_sections) if saved_sections else "unknown",
            details      = (
                f"{performed_by} ({role}) saved section(s): {', '.join(saved_sections)}. "
                f"Case remains at step {case.current_step} ({case.status})."
            ),
        )

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


# ---------- GET /api/cases/<id>/audit — full audit trail for one case ----------
@app.route("/api/cases/<case_id>/audit", methods=["GET"])
def get_case_audit(case_id):
    """
    Returns the complete audit trail for a single case, newest entries first.
    Used by the frontend Audit Trail panel in the case modal.
    """
    try:
        entries = (
            AuditLog.query
            .filter_by(case_id=case_id)
            .order_by(AuditLog.timestamp.desc())
            .all()
        )
        return jsonify([e.to_dict() for e in entries])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- GET /api/audit — global audit trail (instructor view) ----------
@app.route("/api/audit", methods=["GET"])
def get_all_audit():
    """
    Returns the most recent 200 audit entries across all cases.
    Intended for instructor / admin review of overall training activity.
    """
    try:
        entries = (
            AuditLog.query
            .order_by(AuditLog.timestamp.desc())
            .limit(200)
            .all()
        )
        return jsonify([e.to_dict() for e in entries])
    except Exception as e:
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
