from flask import Flask, request, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, case as sa_case
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
# E2B(R3) XML BUILDER
# =========================================================
#
# Generates ICH E2B(R3) / HL7 v3 Individual Case Safety Report XML.
# Endpoint: GET /api/cases/<id>/e2b
# The generated XML conforms to MCCI_IN200100UV01 (batch wrapper)
# containing PORR_IN049016UV (ICSR), per ICH E2B(R3) Nov 2016.

"""
E2B(R3) XML Generator for SkyVigilance SafetyDB
Generates ICH E2B(R3) compliant XML from a SafetyDB Case.to_dict() payload.
Standard:  ICH E2B(R3) - Individual Case Safety Report
Format:    HL7 v3 MCCI_IN200100UV01 batch wrapper -> PORR_IN049016UV
"""

from lxml import etree
from datetime import datetime, timezone
import uuid

NS_HL7 = "urn:hl7-org:v3"
NS_XSI = "http://www.w3.org/2001/XMLSchema-instance"
NSMAP  = {None: NS_HL7, "xsi": NS_XSI}

OID_BATCH_ID       = "2.16.840.1.113883.3.989.2.1.3.22"
OID_MSG_ID         = "2.16.840.1.113883.3.989.2.1.3.1"
OID_WORLDWIDE_ID   = "2.16.840.1.113883.3.989.2.1.3.2"
OID_INTERACTION    = "2.16.840.1.113883.1.6"
OID_MEDDRA         = "2.16.840.1.113883.6.163"
OID_MEDDRA_VER     = "28.1"
OID_ISO3166        = "1.0.3166.1.2.2"
OID_ISO5218        = "1.0.5218"
OID_RECEIVER_MSG   = "2.16.840.1.113883.3.989.2.1.3.12"
OID_SENDER_MSG     = "2.16.840.1.113883.3.989.2.1.3.11"
OID_RECEIVER_BATCH = "2.16.840.1.113883.3.989.2.1.3.14"
OID_SENDER_BATCH   = "2.16.840.1.113883.3.989.2.1.3.13"
OID_ICH_OBS        = "2.16.840.1.113883.3.989.2.1.1.19"
OID_ICH_CAT        = "2.16.840.1.113883.3.989.2.1.1.20"
OID_ICH_RPT_TYPE   = "2.16.840.1.113883.3.989.2.1.1.2"
OID_ICH_RPT_CHAR   = "2.16.840.1.113883.3.989.2.1.1.23"
OID_ICH_SOURCE_RPT = "2.16.840.1.113883.3.989.2.1.1.22"
OID_ICH_QUAL       = "2.16.840.1.113883.3.989.2.1.1.6"
OID_ICH_SENDER_T   = "2.16.840.1.113883.3.989.2.1.1.7"
OID_ICH_OUTCOME    = "2.16.840.1.113883.3.989.2.1.1.11"
OID_ICH_CHAR       = "2.16.840.1.113883.3.989.2.1.1.13"
OID_ICH_ACTION     = "2.16.840.1.113883.3.989.2.1.1.15"
OID_ICH_STUDY_TYPE = "2.16.840.1.113883.3.989.2.1.1.8"
OID_ICH_IDENT      = "2.16.840.1.113883.3.989.2.1.1.4"
OID_HL7_ACT_CODE   = "2.16.840.1.113883.5.4"
OID_HL7_INTERP     = "2.16.840.1.113883.5.83"

SEX_CODES = {"Male": "1", "Female": "2", "Unknown": "0"}
REPORT_TYPE_CODES = {
    "Spontaneous": "1", "Report from studies": "2",
    "Literature": "3", "Other": "3",
}
QUALIFIER_CODES = {
    "Physician": "1", "Pharmacist": "2",
    "Other health professional": "3", "Lawyer": "4", "Consumer": "5",
}
SENDER_TYPE_CODES = {
    "Pharmaceutical company": "1", "Regulatory authority": "2",
    "Health professional": "3", "Regional pharmacovigilance centre": "4", "Other": "5",
}
ACTION_TAKEN_CODES = {
    "Drug withdrawn": "1", "Dose reduced": "2", "Dose increased": "3",
    "Dose not changed": "4", "Not applicable": "5", "Unknown": "6", "N/A": "9",
}
CHAR_CODES = {"Suspect": "1", "Concomitant": "2", "Interacting": "3"}
OUTCOME_CODES = {
    "recovered/resolved": "1", "recovering/resolving": "2",
    "not recovered/not resolved": "3",
    "recovered/resolved with sequelae": "4",
    "fatal": "5", "unknown": "6",
}
SERIOUSNESS_KEY_MAP = {
    "death":           ("34", "death"),
    "lifeThreatening": ("21", "lifeThreatening"),
    "hospitalisation": ("33", "hospitalization"),
    "disability":      ("35", "disabilityIncapacity"),
    "congenital":      ("12", "congenitalAnomaly"),
    "medSignificant":  ("26", "otherMedicallyImportantCondition"),
}
COUNTRY_ISO2 = {
    "United States": "US", "United Kingdom": "GB",
    "Germany": "DE", "France": "FR", "Japan": "JP",
    "India": "IN", "Canada": "CA", "Australia": "AU", "Brazil": "BR",
}
AGE_UNIT_MAP = {"years": "a", "months": "mo", "weeks": "wk", "days": "d", "hours": "h"}


def _uuid():
    return str(uuid.uuid4())

def _ts(dt=None):
    if dt is None:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y%m%d%H%M%S")

def _date(val):
    return str(val).replace("-", "") if val else ""

def _sub(parent, tag, **attrs):
    el = etree.SubElement(parent, f"{{{NS_HL7}}}{tag}", nsmap=NSMAP)
    for k, v in attrs.items():
        if k == "xsi_type":
            el.set(f"{{{NS_XSI}}}type", v)
        else:
            el.set(k, str(v))
    return el

def _txt(parent, tag, text, **attrs):
    el = _sub(parent, tag, **attrs)
    el.text = str(text) if text else ""
    return el

def _obs_code(parent, code, display="", oid=OID_ICH_OBS):
    return _sub(parent, "code",
                code=str(code), codeSystem=oid,
                codeSystemVersion="2.0", displayName=display)

def _bl_val(parent, bval):
    return _sub(parent, "value", xsi_type="BL",
                value="true" if bval else "false")

def _pq_val(parent, val, unit):
    return _sub(parent, "value", xsi_type="PQ",
                value=str(val), unit=str(unit))

def _pert_bool(parent, code, display, bval):
    rel = _sub(parent, "outboundRelationship2", typeCode="PERT")
    obs = _sub(rel, "observation", classCode="OBS", moodCode="EVN")
    _obs_code(obs, code, display)
    _bl_val(obs, bval)
    return rel
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
# MEDDRA TERM MODEL
# =========================================================

class MeddraTerm(db.Model):
    """
    MedDRA 28.1 English terminology — loaded from the official ASCII distribution.
    Stores the full five-level hierarchy for each LLT so a single table lookup
    returns everything the Events tab and E2B XML builder need.

    Populated by load_meddra.py (run once against Neon, then re-run on each
    new MedDRA release after re-extracting the ASCII files).
    """

    __tablename__ = "meddra_terms"

    llt_code       = db.Column(db.String(8),   primary_key=True)
    llt_name       = db.Column(db.String(500),  nullable=False)
    pt_code        = db.Column(db.String(8))
    pt_name        = db.Column(db.String(500))
    hlt_code       = db.Column(db.String(8))
    hlt_name       = db.Column(db.String(500))
    hlgt_code      = db.Column(db.String(8))
    hlgt_name      = db.Column(db.String(500))
    soc_code       = db.Column(db.String(8))
    soc_name       = db.Column(db.String(500))
    soc_abbrev     = db.Column(db.String(10))
    current_llt    = db.Column(db.String(1),   default="Y")
    meddra_version = db.Column(db.String(10),  default="28.1")

    def to_dict(self):
        return {
            "llt_code":   self.llt_code,
            "llt":        self.llt_name,
            "pt_code":    self.pt_code,
            "pt":         self.pt_name,
            "hlt_code":   self.hlt_code,
            "hlt":        self.hlt_name,
            "hlgt_code":  self.hlgt_code,
            "hlgt":       self.hlgt_name,
            "soc_code":   self.soc_code,
            "soc":        self.soc_name,
            "soc_abbrev": self.soc_abbrev,
            "current":    self.current_llt,
            "version":    self.meddra_version,
        }


# =========================================================
# DB INIT (schema-safe)
# =========================================================

def init_db():
    """
    Create any missing tables on startup. Never drops existing tables or data.
    meddra_terms is populated by load_meddra.py and left untouched here.
    """
    with app.app_context():
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




# E2B R3 XML BUILDER
# =========================================================
#
# Full ICH E2B(R3) / HL7 v3 generator.
# Maps SafetyDB Case fields → MCCI_IN200100UV01 batch envelope
# containing PORR_IN049016UV individual case safety report.
#
# Requires: lxml (added to requirements.txt)
# Spec ref: ICH M2 EWG E2B(R3) Implementation Guide v5.0
#


from lxml import etree
from datetime import datetime
import uuid as _uuid_mod

HL7      = "urn:hl7-org:v3"
XSI      = "http://www.w3.org/2001/XMLSchema-instance"
XSI_TYPE = f"{{{XSI}}}type"
NSMAP    = {None: HL7, "xsi": XSI}

# ── E2B OID registry ──────────────────────────────────────────────────────────
OID = {
    "batch_id":         "2.16.840.1.113883.3.989.2.1.3.22",
    "case_id":          "2.16.840.1.113883.3.989.2.1.3.1",
    "worldwide_id":     "2.16.840.1.113883.3.989.2.1.3.2",
    "auth_number":      "2.16.840.1.113883.3.989.2.1.3.4",
    "sender_id":        "2.16.840.1.113883.3.989.2.1.3.11",
    "receiver_id":      "2.16.840.1.113883.3.989.2.1.3.12",
    "batch_sender":     "2.16.840.1.113883.3.989.2.1.3.13",
    "batch_receiver":   "2.16.840.1.113883.3.989.2.1.3.14",
    "cs_msg_type":      "2.16.840.1.113883.3.989.2.1.1.1",
    "cs_report_type":   "2.16.840.1.113883.3.989.2.1.1.2",
    "cs_mrn_type":      "2.16.840.1.113883.3.989.2.1.1.4",
    "cs_reporter_qual": "2.16.840.1.113883.3.989.2.1.1.6",
    "cs_sender_type":   "2.16.840.1.113883.3.989.2.1.1.7",
    "cs_study_type":    "2.16.840.1.113883.3.989.2.1.1.8",
    "cs_outcome":       "2.16.840.1.113883.3.989.2.1.1.11",
    "cs_drug_char":     "2.16.840.1.113883.3.989.2.1.1.13",
    "cs_action_taken":  "2.16.840.1.113883.3.989.2.1.1.15",
    "cs_chall":         "2.16.840.1.113883.3.989.2.1.1.17",
    "cs_data_elem":     "2.16.840.1.113883.3.989.2.1.1.19",
    "cs_organizer":     "2.16.840.1.113883.3.989.2.1.1.20",
    "cs_related_inv":   "2.16.840.1.113883.3.989.2.1.1.22",
    "cs_inv_char":      "2.16.840.1.113883.3.989.2.1.1.23",
    "meddra":           "2.16.840.1.113883.6.163",
    "iso_sex":          "1.0.5218",
    "iso_country":      "1.0.3166.1.2.2",
    "hl7_acts":         "2.16.840.1.113883.5.4",
    "hl7_interaction":  "2.16.840.1.113883.1.6",
    "hl7_interp":       "2.16.840.1.113883.5.83",
}

# ── Lookup tables ─────────────────────────────────────────────────────────────
COUNTRY_CODES = {
    "United States": "US", "United Kingdom": "GB", "Germany": "DE",
    "France": "FR",   "Japan": "JP",      "India": "IN",
    "Canada": "CA",   "Australia": "AU",  "Brazil": "BR",
    "Other": "OTH",
}

SEX_CODES = {"Male": "1", "Female": "2", "Unknown": "0"}

AGE_UNITS = {"years": "a", "months": "mo", "weeks": "wk", "days": "d", "hours": "h"}

REPORTER_QUAL = {
    "Physician": "1", "Pharmacist": "2", "Nurse": "3",
    "Other HCP": "3", "Lawyer": "4", "Consumer": "5", "Unknown": "3",
}

ACTION_TAKEN = {
    "Withdrawn": "1", "Dose reduced": "2", "Dose increased": "3",
    "Dose not changed": "4", "Not applicable": "5", "Unknown": "6",
}

DECHALLENGE = {
    "Positive – Event abated on withdrawal": "1",
    "Negative – Event did not abate": "2",
    "Not done": "3",  "Unknown": "4",  "N/A": "9",
}

RECHALLENGE = {
    "Positive – Event recurred": "1",
    "Negative – Event did not recur": "2",
    "Not done": "3",  "Unknown": "4",  "N/A": "9",
}

OUTCOMES = {
    "Recovered / Resolved":           "1",
    "Recovering / Resolving":         "2",
    "Not recovered / Not resolved":   "3",
    "Recovered with sequelae":        "4",
    "Fatal":                          "5",
    "Unknown":                        "6",
}

SERIOUS_CODES = {
    "death":            "34",   # resultsInDeath
    "lifeThreatening":  "21",   # lifeThreatening
    "hospitalised":     "33",   # requiresInpatientHospitalization
    "hospitalisation":  "33",
    "disability":       "35",   # resultsInPersistentOrSignificantDisability
    "congenital":       "12",   # congenitalAnomalyBirthDefect
    "medSignificant":   "26",   # otherMedicallyImportantCondition
}

SOURCE_TYPE = {
    "Spontaneous": "1", "Literature": "2", "Clinical Study": "2",
    "Report from studies": "2", "Regulatory Authority": "3",
    "Compassionate Use": "3", "Other": "3",
}

DRUG_CHAR = {
    "Suspect": "1", "Concomitant": "2",
    "Treatment/Other": "2", "Interacting": "3",
}

SENDER_TYPE = {
    "Pharmaceutical company": "1", "Regulatory authority": "2",
    "Health professional": "3",   "Regional pharmacovigilance centre": "4",
    "Other": "5",
}


# ── XML helpers ───────────────────────────────────────────────────────────────

def E(tag, attrib=None, text=None, parent=None):
    """Create an HL7 namespace element; append to parent if given."""
    e = (etree.Element(f"{{{HL7}}}{tag}", attrib or {}, nsmap=NSMAP)
         if parent is None
         else etree.SubElement(parent, f"{{{HL7}}}{tag}", attrib or {}))
    if text is not None:
        e.text = str(text)
    return e


def d(iso_date):
    """Convert YYYY-MM-DD → YYYYMMDD (E2B date format). Safe for None."""
    return iso_date.replace("-", "") if iso_date else None


def ts_now():
    return datetime.utcnow().strftime("%Y%m%d%H%M%S")


def new_uuid():
    return str(_uuid_mod.uuid4())


def coded_obs(parent, code_val, disp_name, value_attribs, value_text=None):
    """
    Build a standard 'subjectOf2 > observation > code + value' block.
    Returns the value element.
    """
    subj = E("subjectOf2", {"typeCode": "SBJ"}, parent=parent)
    obs  = E("observation", {"classCode": "OBS", "moodCode": "EVN"}, parent=subj)
    E("code", {
        "code":              code_val,
        "codeSystem":        OID["cs_data_elem"],
        "codeSystemVersion": "2.0",
        "displayName":       disp_name,
    }, parent=obs)
    val = E("value", value_attribs, text=value_text, parent=obs)
    return val


# ── Main builder ──────────────────────────────────────────────────────────────

def build_e2b_xml(case):
    """
    Convert a SafetyDB Case ORM object → ICH E2B(R3) XML string.
    Returns a UTF-8 encoded XML string beginning with the XML declaration.
    """
    now   = ts_now()
    tr    = case.triage   or {}
    gen   = case.general  or {}
    pat   = case.patient  or {}
    prods = case.products or []
    evts  = case.events   or []
    med   = case.medical  or {}

    # ──────────────────────────────────────────────────────────────────────────
    # MCCI_IN200100UV01  —  Batch envelope
    # ──────────────────────────────────────────────────────────────────────────
    root = E("MCCI_IN200100UV01", {"ITSVersion": "XML_1.0"})
    E("id",             {"root": OID["batch_id"],     "extension": f"BATCH-{now}"},                  parent=root)
    E("creationTime",   {"value": now},                                                               parent=root)
    E("responseModeCode", {"code": "D"},                                                              parent=root)
    E("interactionId",  {"root": OID["hl7_interaction"], "extension": "MCCI_IN200100UV01"},           parent=root)
    E("name",           {"code": "1", "codeSystem": OID["cs_msg_type"],
                          "codeSystemVersion": "2.0", "displayName": "ICHICSR"},                     parent=root)

    # ──────────────────────────────────────────────────────────────────────────
    # PORR_IN049016UV  —  Individual Safety Report
    # ──────────────────────────────────────────────────────────────────────────
    porr = E("PORR_IN049016UV", parent=root)
    E("id",               {"root": OID["case_id"], "extension": case.id},                            parent=porr)
    E("creationTime",     {"value": now},                                                             parent=porr)
    E("interactionId",    {"root": OID["hl7_interaction"], "extension": "PORR_IN049016UV"},           parent=porr)
    E("processingCode",   {"code": "P"},                                                              parent=porr)
    E("processingModeCode", {"code": "T"},                                                            parent=porr)
    E("acceptAckCode",    {"code": "AL"},                                                             parent=porr)

    recv_dev = E("device", {"classCode": "DEV", "determinerCode": "INSTANCE"},
                 parent=E("receiver", {"typeCode": "RCV"}, parent=porr))
    E("id", {"root": OID["receiver_id"], "extension": "EVTEST"}, parent=recv_dev)

    snd_dev = E("device", {"classCode": "DEV", "determinerCode": "INSTANCE"},
                parent=E("sender", {"typeCode": "SND"}, parent=porr))
    E("id", {"root": OID["sender_id"], "extension": "SKYVIGILANCE"}, parent=snd_dev)

    # controlActProcess
    cap = E("controlActProcess", {"classCode": "CACT", "moodCode": "EVN"}, parent=porr)
    E("code",         {"code": "PORR_TE049016UV", "codeSystem": OID["hl7_interaction"]}, parent=cap)
    E("effectiveTime", {"value": now},                                                   parent=cap)

    # ──────────────────────────────────────────────────────────────────────────
    # investigationEvent
    # ──────────────────────────────────────────────────────────────────────────
    inv = E("investigationEvent", {"classCode": "INVSTG", "moodCode": "EVN"},
            parent=E("subject", {"typeCode": "SUBJ"}, parent=cap))

    E("id",   {"root": OID["case_id"], "extension": case.id},      parent=inv)
    E("code", {"code": "PAT_ADV_EVNT", "codeSystem": OID["hl7_acts"]}, parent=inv)

    # Narrative
    if case.narrative:
        E("text", parent=inv, text=case.narrative)

    E("statusCode", {"code": "active"}, parent=inv)

    # Receipt date (E.1) and availability time (E.2)
    if tr.get("receiptDate"):
        E("low", {"value": d(tr["receiptDate"])},
          parent=E("effectiveTime", parent=inv))

    report_date = gen.get("centralReceiptDate") or tr.get("receiptDate")
    E("availabilityTime", {"value": d(report_date) if report_date else now[:8]}, parent=inv)

    # ──────────────────────────────────────────────────────────────────────────
    # adverseEventAssessment
    # ──────────────────────────────────────────────────────────────────────────
    assessment = E("adverseEventAssessment", {"classCode": "INVSTG", "moodCode": "EVN"},
                   parent=E("component", {"typeCode": "COMP"}, parent=inv))

    prim_role = E("primaryRole", {"classCode": "INVSBJ"},
                  parent=E("subject1", {"typeCode": "SBJ"}, parent=assessment))

    # ── Patient (B.1) ────────────────────────────────────────────────────────
    player = E("player1", {"classCode": "PSN", "determinerCode": "INSTANCE"}, parent=prim_role)

    # B.1.1 Patient initials
    initials = pat.get("initials") or tr.get("patientInitials")
    if initials:
        E("name", parent=player, text=initials)

    # B.1.2.1 Sex
    sex_code = SEX_CODES.get(pat.get("sex", ""), "0")
    E("administrativeGenderCode", {"code": sex_code, "codeSystem": OID["iso_sex"]}, parent=player)

    # B.1.2.2a / B.1.3 Date of birth
    if pat.get("dob"):
        E("birthTime", {"value": d(pat["dob"])}, parent=player)

    # Patient ID (if present)
    if pat.get("patId"):
        id_ent = E("asIdentifiedEntity", {"classCode": "IDENT"}, parent=player)
        E("id", {"root": OID["case_id"], "extension": pat["patId"]}, parent=id_ent)
        E("code", {"code": "1", "codeSystem": OID["cs_mrn_type"],
                   "codeSystemVersion": "2.0", "displayName": "GP"}, parent=id_ent)

    # B.1.4 Age at time of onset
    if pat.get("age"):
        val = coded_obs(prim_role, "3", "age",
                        {XSI_TYPE: "PQ",
                         "value": str(pat["age"]),
                         "unit":  AGE_UNITS.get(pat.get("ageUnit", "years"), "a")})

    # B.1.5 Body weight
    if pat.get("weight"):
        coded_obs(prim_role, "7", "bodyWeight",
                  {XSI_TYPE: "PQ", "value": str(pat["weight"]), "unit": "kg"})

    # B.1.6 Height
    if pat.get("height"):
        coded_obs(prim_role, "17", "height",
                  {XSI_TYPE: "PQ", "value": str(pat["height"]), "unit": "cm"})

    # ── Medical History (B.1.7) ───────────────────────────────────────────────
    history_entries = [h for h in (pat.get("otherHistory") or []) if h.get("description")]
    if history_entries:
        hist_org = E("organizer", {"classCode": "CATEGORY", "moodCode": "EVN"},
                     parent=E("subjectOf2", {"typeCode": "SBJ"}, parent=prim_role))
        E("code", {"code": "1", "codeSystem": OID["cs_organizer"],
                   "codeSystemVersion": "2.0",
                   "displayName": "relevantMedicalHistoryAndConcurrentConditions"}, parent=hist_org)

        for h in history_entries:
            h_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                      parent=E("component", {"typeCode": "COMP"}, parent=hist_org))
            # No MedDRA code available from the free-text history form
            code_el = E("code", {"nullFlavor": "UNK"}, parent=h_obs)
            E("originalText", parent=code_el, text=h["description"])

            if h.get("startDate") or h.get("stopDate"):
                eff = E("effectiveTime", {XSI_TYPE: "IVL_TS"}, parent=h_obs)
                if h.get("startDate"): E("low",  {"value": d(h["startDate"])}, parent=eff)
                if h.get("stopDate"):  E("high", {"value": d(h["stopDate"])},  parent=eff)

            if h.get("ongoing"):
                cont_rel = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                             parent=E("inboundRelationship", {"typeCode": "REFR"}, parent=h_obs))
                E("code", {"code": "13", "codeSystem": OID["cs_data_elem"],
                           "codeSystemVersion": "2.0", "displayName": "continuing"}, parent=cont_rel)
                E("value", {XSI_TYPE: "BL", "value": "true"}, parent=cont_rel)

            if h.get("notes"):
                note_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                             parent=E("outboundRelationship2", {"typeCode": "COMP"}, parent=h_obs))
                E("code", {"code": "10", "codeSystem": OID["cs_data_elem"],
                           "codeSystemVersion": "2.0", "displayName": "comment"}, parent=note_obs)
                E("value", {XSI_TYPE: "ED"}, text=h["notes"], parent=note_obs)

    # ── Lab Tests (B.1.7h) ────────────────────────────────────────────────────
    lab_entries = [l for l in (pat.get("labData") or []) if l.get("testName")]
    if lab_entries:
        test_org = E("organizer", {"classCode": "CATEGORY", "moodCode": "EVN"},
                     parent=E("subjectOf2", {"typeCode": "SBJ"}, parent=prim_role))
        E("code", {"code": "3", "codeSystem": OID["cs_organizer"],
                   "codeSystemVersion": "2.0",
                   "displayName": "testsAndProceduresRelevantToTheInvestigation"}, parent=test_org)

        for lab in lab_entries:
            t_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                      parent=E("component", {"typeCode": "COMP"}, parent=test_org))
            t_code = E("code", {"code": "10000001", "codeSystem": OID["meddra"]}, parent=t_obs)
            E("originalText", parent=t_code, text=lab["testName"])

            if lab.get("testDate"):
                E("effectiveTime", {"value": d(lab["testDate"])}, parent=t_obs)

            if lab.get("result"):
                result_val = lab["result"]
                if lab.get("units"):
                    result_val += f" {lab['units']}"
                E("value", {XSI_TYPE: "ED"}, text=result_val, parent=t_obs)

            for bound, interp_code in [(lab.get("normLow"), "L"), (lab.get("normHigh"), "H")]:
                if bound:
                    rr_range = E("observationRange", {"classCode": "OBS", "moodCode": "EVN.CRT"},
                                 parent=E("referenceRange", {"typeCode": "REFV"}, parent=t_obs))
                    E("value",  {XSI_TYPE: "PQ", "value": str(bound),
                                 "unit": lab.get("units", "")}, parent=rr_range)
                    E("interpretationCode", {"code": interp_code,
                                             "codeSystem": OID["hl7_interp"]}, parent=rr_range)

    # ── Drug Information (B.4 / B.5) ─────────────────────────────────────────
    drug_ids = []   # [(uuid_str, drug_dict), ...]

    if prods:
        drug_org = E("organizer", {"classCode": "CATEGORY", "moodCode": "EVN"},
                     parent=E("subjectOf2", {"typeCode": "SBJ"}, parent=prim_role))
        E("code", {"code": "4", "codeSystem": OID["cs_organizer"],
                   "codeSystemVersion": "2.0", "displayName": "drugInformation"}, parent=drug_org)

        for drug in prods:
            drug_uuid = new_uuid()
            drug_ids.append((drug_uuid, drug))

            sub_admin = E("substanceAdministration", {"classCode": "SBADM", "moodCode": "EVN"},
                          parent=E("component", {"typeCode": "COMP"}, parent=drug_org))
            E("id", {"root": drug_uuid}, parent=sub_admin)

            # ── Product identification ──
            product = E("kindOfProduct", {"classCode": "MMAT", "determinerCode": "KIND"},
                        parent=E("instanceOfKind", {"classCode": "INST"},
                                 parent=E("consumable", {"typeCode": "CSM"}, parent=sub_admin)))

            if drug.get("name"):
                E("name", parent=product, text=drug["name"])

            # INN / generic name via activeIngredient (E2B R3 §B.4.k.2.2)
            if drug.get("genericName"):
                ing_subst = E("ingredientSubstance",
                              {"classCode": "MMAT", "determinerCode": "KIND"},
                              parent=E("ingredient",
                                       {"classCode": "INGR", "determinerCode": "KIND"},
                                       parent=E("activeIngredient", {"classCode": "ACTI"},
                                                parent=product)))
                E("name", parent=ing_subst, text=drug["genericName"])

            # Marketing authorisation (B.4.k.3.1 / B.4.k.3.2)
            if drug.get("authNumber") or drug.get("authCountry"):
                approval = E("approval", {"classCode": "CNTRCT", "moodCode": "EVN"},
                             parent=E("subjectOf", {"typeCode": "SBJ"},
                                      parent=E("asManufacturedProduct", {"classCode": "MANU"},
                                               parent=product)))
                if drug.get("authNumber"):
                    E("id", {"root": OID["auth_number"], "extension": drug["authNumber"]},
                      parent=approval)
                if drug.get("authCountry"):
                    ctry_code = COUNTRY_CODES.get(drug["authCountry"],
                                                   drug["authCountry"][:2].upper())
                    E("code", {"code": ctry_code, "codeSystem": OID["iso_country"]},
                      parent=E("territory", {"classCode": "NAT", "determinerCode": "INSTANCE"},
                               parent=E("territorialAuthority", {"classCode": "TERR"},
                                        parent=E("author", {"typeCode": "AUT"}, parent=approval))))

            # ── Dosage regimen (B.4.k.4 – B.4.k.6) ──
            if any(drug.get(f) for f in ("dose", "route", "startDate", "stopDate",
                                          "frequency", "formulation", "batch")):
                dose_admin = E("substanceAdministration",
                               {"classCode": "SBADM", "moodCode": "EVN"},
                               parent=E("outboundRelationship2", {"typeCode": "COMP"},
                                        parent=sub_admin))

                if drug.get("frequency"):
                    E("text", parent=dose_admin, text=drug["frequency"])

                if drug.get("startDate") or drug.get("stopDate"):
                    eff = E("effectiveTime", {XSI_TYPE: "IVL_TS"}, parent=dose_admin)
                    if drug.get("startDate"):
                        E("low",  {"value": d(drug["startDate"])}, parent=eff)
                    if drug.get("stopDate"):
                        E("high", {"value": d(drug["stopDate"])},  parent=eff)

                if drug.get("route"):
                    route_el = E("routeCode", {"code": drug["route"]}, parent=dose_admin)
                    E("originalText", parent=route_el, text=drug["route"])

                if drug.get("dose"):
                    E("doseQuantity",
                      {"value": str(drug["dose"]), "unit": drug.get("doseUnit", "mg")},
                      parent=dose_admin)

                # Formulation (B.4.k.4.1)
                if drug.get("formulation"):
                    form_prod = E("kindOfProduct",
                                  {"classCode": "MMAT", "determinerCode": "KIND"},
                                  parent=E("instanceOfKind", {"classCode": "INST"},
                                           parent=E("consumable", {"typeCode": "CSM"},
                                                    parent=dose_admin)))
                    fc = E("formCode", {"code": drug["formulation"]}, parent=form_prod)
                    E("originalText", parent=fc, text=drug["formulation"])

                # Batch/lot number (B.4.k.4.2)
                if drug.get("batch"):
                    lot = E("productInstanceInstance",
                            {"classCode": "MMAT", "determinerCode": "INSTANCE"},
                            parent=E("instanceOfKind", {"classCode": "INST"},
                                     parent=E("consumable", {"typeCode": "CSM"},
                                              parent=dose_admin)))
                    E("lotNumberText", parent=lot, text=drug["batch"])

            # ── Indication (B.4.k.11) ──
            if drug.get("indication"):
                ind_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                            parent=E("inboundRelationship", {"typeCode": "RSON"},
                                     parent=sub_admin))
                E("code", {"code": "19", "codeSystem": OID["cs_data_elem"],
                           "codeSystemVersion": "2.0", "displayName": "indication"}, parent=ind_obs)
                ind_val = E("value", {XSI_TYPE: "CE", "code": "10000001",
                                      "codeSystem": OID["meddra"],
                                      "codeSystemVersion": "28.1"}, parent=ind_obs)
                E("originalText", parent=ind_val, text=drug["indication"])

            # ── Action taken (B.4.k.7) ──
            if drug.get("actionTaken"):
                act_obs = E("act", {"classCode": "ACT", "moodCode": "EVN"},
                            parent=E("inboundRelationship", {"typeCode": "CAUS"},
                                     parent=sub_admin))
                E("code", {XSI_TYPE: "CE",
                            "code": ACTION_TAKEN.get(drug["actionTaken"], "5"),
                            "codeSystem": OID["cs_action_taken"],
                            "codeSystemVersion": "2.0"}, parent=act_obs)

            # ── Dechallenge (B.4.k.8) ──
            if drug.get("dechallenge"):
                ch_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                           parent=E("outboundRelationship2", {"typeCode": "PERT"},
                                    parent=sub_admin))
                E("code", {"code": "16", "codeSystem": OID["cs_data_elem"],
                           "codeSystemVersion": "2.0", "displayName": "dechallenge"}, parent=ch_obs)
                E("value", {XSI_TYPE: "CE",
                             "code": DECHALLENGE.get(drug["dechallenge"], "4"),
                             "codeSystem": OID["cs_chall"],
                             "codeSystemVersion": "2.0"}, parent=ch_obs)

            # ── Rechallenge (B.4.k.9) ──
            if drug.get("rechallenge"):
                rch_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                            parent=E("outboundRelationship2", {"typeCode": "PERT"},
                                     parent=sub_admin))
                E("code", {"code": "32", "codeSystem": OID["cs_data_elem"],
                           "codeSystemVersion": "2.0", "displayName": "rechallenge"}, parent=rch_obs)
                E("value", {XSI_TYPE: "CE",
                             "code": RECHALLENGE.get(drug["rechallenge"], "4"),
                             "codeSystem": OID["cs_chall"],
                             "codeSystemVersion": "2.0"}, parent=rch_obs)

            # ── Blinded flag (required structural element) ──
            blind_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                          parent=E("outboundRelationship2", {"typeCode": "PERT"},
                                   parent=sub_admin))
            E("code", {"code": "6", "codeSystem": OID["cs_data_elem"],
                       "codeSystemVersion": "2.0", "displayName": "blinded"}, parent=blind_obs)
            E("value", {XSI_TYPE: "BL", "value": "false"}, parent=blind_obs)

    # ── Reactions / Adverse Events (B.2) ─────────────────────────────────────
    react_ids = []   # [(uuid_str, event_dict), ...]

    for evt in evts:
        r_uuid = new_uuid()
        react_ids.append((r_uuid, evt))

        r_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                  parent=E("subjectOf2", {"typeCode": "SBJ"}, parent=prim_role))
        E("id",   {"root": r_uuid}, parent=r_obs)
        E("code", {"code": "29", "codeSystem": OID["cs_data_elem"],
                   "codeSystemVersion": "2.0", "displayName": "reaction"}, parent=r_obs)

        # Timing — onset date (B.2.i.4) / end date (B.2.i.5)
        if evt.get("onsetDate") or evt.get("stopDate"):
            eff = E("effectiveTime", {XSI_TYPE: "IVL_TS"}, parent=r_obs)
            if evt.get("onsetDate"): E("low",  {"value": d(evt["onsetDate"])}, parent=eff)
            if evt.get("stopDate"):  E("high", {"value": d(evt["stopDate"])},  parent=eff)

        # Reaction term — MedDRA PT (B.2.i.2.1a) + verbatim (B.2.i.1.1a)
        meddra_code = evt.get("pt_code") or evt.get("meddraCode", "10000001")
        r_val = E("value", {XSI_TYPE: "CE",
                             "code":              meddra_code,
                             "codeSystem":        OID["meddra"],
                             "codeSystemVersion": "28.1"}, parent=r_obs)
        # Verbatim original term
        if evt.get("term"):
            E("originalText", {"language": "eng"}, text=evt["term"], parent=r_val)

        # Country of occurrence (B.2.i.3 — derived from triage COI)
        ctry = tr.get("country")
        if ctry:
            ctry_code = COUNTRY_CODES.get(ctry, ctry[:2].upper())
            E("code", {"code": ctry_code, "codeSystem": OID["iso_country"]},
              parent=E("locatedPlace", {"classCode": "COUNTRY", "determinerCode": "INSTANCE"},
                       parent=E("locatedEntity", {"classCode": "LOCE"},
                                parent=E("location", {"typeCode": "LOC"}, parent=r_obs))))

        # Seriousness (B.2.i.7.x) — event-level first, fall back to triage/general
        serious = evt.get("seriousness") or {}
        if not any(serious.values()):
            serious = tr.get("seriousness") or gen.get("seriousness") or {}
        for key, code_val in SERIOUS_CODES.items():
            if serious.get(key):
                s_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                          parent=E("outboundRelationship2", {"typeCode": "PERT"}, parent=r_obs))
                E("code", {"code": code_val, "codeSystem": OID["cs_data_elem"],
                           "codeSystemVersion": "2.0"}, parent=s_obs)
                E("value", {XSI_TYPE: "BL", "value": "true"}, parent=s_obs)

        # Outcome (B.2.i.8)
        if evt.get("outcome"):
            out_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                        parent=E("outboundRelationship2", {"typeCode": "PERT"}, parent=r_obs))
            E("code", {"code": "27", "codeSystem": OID["cs_data_elem"],
                       "codeSystemVersion": "2.0", "displayName": "outcome"}, parent=out_obs)
            E("value", {XSI_TYPE: "CE",
                         "code": OUTCOMES.get(evt["outcome"], "6"),
                         "codeSystem": OID["cs_outcome"],
                         "codeSystemVersion": "2.0"}, parent=out_obs)

        # Death date — if event is fatal
        if evt.get("seriousness", {}).get("death") and evt.get("deathDate"):
            death_obs = E("observation", {"classCode": "OBS", "moodCode": "EVN"},
                          parent=E("outboundRelationship2", {"typeCode": "PERT"}, parent=r_obs))
            E("code", {"code": "34", "codeSystem": OID["cs_data_elem"],
                       "codeSystemVersion": "2.0", "displayName": "dateOfDeath"}, parent=death_obs)
            E("value", {XSI_TYPE: "TS", "value": d(evt["deathDate"])}, parent=death_obs)

    # ── Causality Assessments (B.4.k.18 / B.4.k.19) ─────────────────────────

    # WHO-UMC result (computed by Medical Reviewer)
    if med.get("causality"):
        caus_obs = E("causalityAssessment", {"classCode": "OBS", "moodCode": "EVN"},
                     parent=E("component", {"typeCode": "COMP"}, parent=assessment))
        E("code", {"code": "39", "codeSystem": OID["cs_data_elem"],
                   "codeSystemVersion": "2.0", "displayName": "causality"}, parent=caus_obs)
        E("value", {XSI_TYPE: "ST"}, text=med["causality"], parent=caus_obs)

        method_el = E("methodCode", parent=caus_obs)
        E("originalText", parent=method_el,
          text=med.get("causalityMethod", "WHO-UMC"))

        src_assign = E("assignedEntity", {"classCode": "ASSIGNED"},
                       parent=E("author", {"typeCode": "AUT"}, parent=caus_obs))
        E("originalText", parent=E("code", parent=src_assign), text="Medical Reviewer")

        # Cross-link to first reaction
        if react_ids:
            E("id", {"root": react_ids[0][0]},
              parent=E("adverseEffectReference", {"classCode": "OBS", "moodCode": "EVN"},
                       parent=E("subject1", {"typeCode": "SUBJ"}, parent=caus_obs)))
        # Cross-link to first suspect drug
        if drug_ids:
            E("id", {"root": drug_ids[0][0]},
              parent=E("productUseReference", {"classCode": "SBADM", "moodCode": "EVN"},
                       parent=E("subject2", {"typeCode": "SUBJ"}, parent=caus_obs)))

    # Naranjo score (supplementary assessment)
    if med.get("naranjResult"):
        nar_obs = E("causalityAssessment", {"classCode": "OBS", "moodCode": "EVN"},
                    parent=E("component", {"typeCode": "COMP"}, parent=assessment))
        E("code", {"code": "39", "codeSystem": OID["cs_data_elem"],
                   "codeSystemVersion": "2.0", "displayName": "causality"}, parent=nar_obs)
        score_text = (f"{med['naranjResult']}"
                      f" (Naranjo score: {med.get('naranjScore', 'N/A')})")
        E("value", {XSI_TYPE: "ST"}, text=score_text, parent=nar_obs)
        E("originalText", parent=E("methodCode", parent=nar_obs), text="Naranjo Algorithm")

    # ── Intervention Characterization — drug role (Suspect/Concomitant) ──────
    for d_uuid, drug in drug_ids:
        ic_obs = E("causalityAssessment", {"classCode": "OBS", "moodCode": "EVN"},
                   parent=E("component", {"typeCode": "COMP"}, parent=assessment))
        E("code", {"code": "20", "codeSystem": OID["cs_data_elem"],
                   "codeSystemVersion": "2.0",
                   "displayName": "interventionCharacterization"}, parent=ic_obs)
        E("value", {XSI_TYPE: "CE",
                     "code": DRUG_CHAR.get(drug.get("role", "Suspect"), "1"),
                     "codeSystem": OID["cs_drug_char"],
                     "codeSystemVersion": "2.0"}, parent=ic_obs)
        E("id", {"root": d_uuid},
          parent=E("productUseReference", {"classCode": "SBADM", "moodCode": "EVN"},
                   parent=E("subject2", {"typeCode": "SUBJ"}, parent=ic_obs)))

    # ──────────────────────────────────────────────────────────────────────────
    # Reporter Information (A.2.1 Primary Source)
    # ──────────────────────────────────────────────────────────────────────────
    reporter_first = tr.get("reporterFirst", "")
    reporter_last  = tr.get("reporterLast",  "")
    reporter_qual  = tr.get("qualification", "")
    reporter_inst  = tr.get("institution",   "")

    if reporter_first or reporter_last or reporter_inst:
        rep_rel = E("outboundRelationship", {"typeCode": "SPRT"}, parent=inv)
        E("priorityNumber", {"value": "1"}, parent=rep_rel)

        rel_inv = E("relatedInvestigation", {"classCode": "INVSTG", "moodCode": "EVN"},
                    parent=rep_rel)
        E("code", {"code": "2", "codeSystem": OID["cs_related_inv"],
                   "codeSystemVersion": "2.0", "displayName": "sourceReport"}, parent=rel_inv)

        rep_subj2 = E("subjectOf2", {"typeCode": "SUBJ"}, parent=rel_inv)
        ctrl_act  = E("controlActEvent", {"classCode": "CACT", "moodCode": "EVN"}, parent=rep_subj2)
        assigned  = E("assignedEntity", {"classCode": "ASSIGNED"},
                      parent=E("author", {"typeCode": "AUT"}, parent=ctrl_act))

        person   = E("assignedPerson", {"classCode": "PSN", "determinerCode": "INSTANCE"},
                     parent=assigned)
        name_el  = E("name", parent=person)
        if reporter_first: E("given",  parent=name_el, text=reporter_first)
        if reporter_last:  E("family", parent=name_el, text=reporter_last)

        if reporter_qual:
            E("code", {"code": REPORTER_QUAL.get(reporter_qual, "3"),
                        "codeSystem": OID["cs_reporter_qual"],
                        "codeSystemVersion": "2.0"},
              parent=E("asQualifiedEntity", {"classCode": "QUAL"}, parent=person))

        if ctry:
            ctry_code = COUNTRY_CODES.get(ctry, "OTH")
            E("code", {"code": ctry_code, "codeSystem": OID["iso_country"]},
              parent=E("location", {"classCode": "COUNTRY", "determinerCode": "INSTANCE"},
                       parent=E("asLocatedEntity", {"classCode": "LOCE"}, parent=person)))

        if reporter_inst:
            E("name", parent=E("representedOrganization",
                                {"classCode": "ORG", "determinerCode": "INSTANCE"},
                                parent=assigned),
              text=reporter_inst)

    # ──────────────────────────────────────────────────────────────────────────
    # Sender Information (A.3)
    # ──────────────────────────────────────────────────────────────────────────
    send_assign = E("assignedEntity", {"classCode": "ASSIGNED"},
                    parent=E("author", {"typeCode": "AUT"},
                             parent=E("controlActEvent", {"classCode": "CACT", "moodCode": "EVN"},
                                      parent=E("subjectOf1", {"typeCode": "SUBJ"}, parent=inv))))
    E("code", {"code": "1",   # Pharmaceutical company
                "codeSystem": OID["cs_sender_type"],
                "codeSystemVersion": "2.0"}, parent=send_assign)
    E("name",
      parent=E("representedOrganization",
               {"classCode": "ORG", "determinerCode": "INSTANCE"}, parent=send_assign),
      text="SkyVigilance SafetyDB Training Platform — For training purposes only")

    # ──────────────────────────────────────────────────────────────────────────
    # ICH Report Type (A.1.7.1)
    # ──────────────────────────────────────────────────────────────────────────
    source_type = gen.get("sourceType") or tr.get("reportType") or "Spontaneous"
    rep_type_char = E("investigationCharacteristic", {"classCode": "OBS", "moodCode": "EVN"},
                      parent=E("subjectOf2", {"typeCode": "SUBJ"}, parent=inv))
    E("code", {"code": "1", "codeSystem": OID["cs_inv_char"],
               "codeSystemVersion": "2.0", "displayName": "ichReportType"}, parent=rep_type_char)
    E("value", {XSI_TYPE: "CE",
                 "code":       SOURCE_TYPE.get(source_type, "1"),
                 "codeSystem": OID["cs_report_type"],
                 "codeSystemVersion": "2.0"}, parent=rep_type_char)

    # ──────────────────────────────────────────────────────────────────────────
    # Batch-level sender / receiver (on root MCCI wrapper)
    # ──────────────────────────────────────────────────────────────────────────
    batch_recv_dev = E("device", {"classCode": "DEV", "determinerCode": "INSTANCE"},
                       parent=E("receiver", {"typeCode": "RCV"}, parent=root))
    E("id", {"root": OID["batch_receiver"], "extension": "EVTEST"}, parent=batch_recv_dev)

    batch_snd_dev = E("device", {"classCode": "DEV", "determinerCode": "INSTANCE"},
                      parent=E("sender", {"typeCode": "SND"}, parent=root))
    E("id", {"root": OID["batch_sender"], "extension": "SKYVIGILANCE"}, parent=batch_snd_dev)

    # Serialise
    xml_str = (etree.tostring(root, pretty_print=True,
                              xml_declaration=True, encoding="UTF-8")
               .decode("utf-8"))

    # lxml 6.x serialises {urn:hl7-org:v3}name as <n> (HL7 compact form).
    # E2B R3 regulatory systems expect the full <name> element — restore it.
    xml_str = xml_str.replace("<n>", "<name>").replace("</n>", "</name>")

    return xml_str


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


# ---------- GET /api/cases/<id>/e2b — E2B(R3) XML download ----------
# NOTE: Single consolidated handler below (export_e2b). Previous duplicate
# stubs have been removed. Flask only honours the first registered route
# for a given URL+method, so having multiple was silently ignoring the others.


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


# (removed duplicate get_case_e2b handler — see export_e2b below)


# ---------- GET /api/cases/<id>/e2b — E2B(R3) XML download (consolidated) ----------
@app.route("/api/cases/<case_id>/e2b", methods=["GET"])
def export_e2b(case_id):
    """
    Generate and return an ICH E2B(R3) XML file for a single case.
    The file is served as an attachment so the browser downloads it directly.

    MedDRA version: 28.1 (English)
    XML standard:   ICH E2B(R3) — MCCI_IN200100UV01 / PORR_IN049016UV
    Regulatory ref: ICH E2B(R3) Implementation Guide v5.0
                    EU GVP Module VI
                    FDA 21 CFR 314.81 / 21 CFR 600.80
    """
    try:
        case = Case.query.get(case_id)
        if case is None:
            return jsonify({"error": "Case not found"}), 404

        xml_str = build_e2b_xml(case)

        # Log the export in the audit trail
        try:
            log_event(
                case_id      = case_id,
                action_type  = "E2B_EXPORTED",
                performed_by = request.args.get("user", "unknown"),
                role         = request.args.get("role", "unknown"),
                step_from    = case.current_step,
                step_to      = case.current_step,
                section      = "e2b_export",
                details      = (
                    f"E2B(R3) XML exported for case {case_id}. "
                    f"Standard: ICH E2B(R3) MCCI_IN200100UV01. "
                    f"MedDRA version: 28.1."
                ),
            )
            db.session.commit()
        except Exception:
            pass  # Audit failure must never block the export

        filename = f"E2B_{case_id}.xml"
        return Response(
            xml_str,
            mimetype="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type":        "application/xml; charset=utf-8",
                "X-E2B-Standard":      "ICH E2B(R3)",
                "X-MedDRA-Version":    "28.1",
                "X-Case-ID":           case_id,
                "X-Generated-By":      "SkyVigilance SafetyDB Training Platform",
            }
        )

    except Exception as e:
        return jsonify({"error": f"E2B export failed: {str(e)}"}), 500


# ---------- GET /api/meddra/search — real-time term search ----------
@app.route("/api/meddra/search", methods=["GET"])
def search_meddra():
    """
    Full-text search across MedDRA 28.1 LLT and PT names.

    Query params:
      q          — search string (required, min 2 chars)
      current    — "true" (default) | "false" — filter to current LLTs only
      limit      — max results to return (default 20, max 50)

    Returns a JSON array of term objects with the full five-level hierarchy.
    Uses PostgreSQL ILIKE for broad compatibility (GIN index created by
    load_meddra.py will accelerate this automatically on Neon).

    Example:
      GET /api/meddra/search?q=headache
      GET /api/meddra/search?q=stevens&current=true&limit=10
    """
    try:
        q       = (request.args.get("q") or "").strip()
        current = request.args.get("current", "true").lower() != "false"
        limit   = min(int(request.args.get("limit", 20)), 50)

        if len(q) < 2:
            return jsonify([])

        # Check the table actually exists (it won't exist until load_meddra.py is run)
        try:
            MeddraTerm.query.limit(1).all()
        except Exception:
            return jsonify({
                "error": "MedDRA table not yet loaded.",
                "hint":  "Run load_meddra.py against your Neon database to populate meddra_terms."
            }), 503

        pattern = f"%{q}%"
        query   = MeddraTerm.query.filter(
            or_(
                MeddraTerm.llt_name.ilike(pattern),
                MeddraTerm.pt_name.ilike(pattern),
            )
        )

        if current:
            query = query.filter(MeddraTerm.current_llt == "Y")

        # Boost exact PT prefix matches to the top, then LLT prefix, then all others
        results = (
            query
            .order_by(
                sa_case(
                    (MeddraTerm.pt_name.ilike(f"{q}%"),  1),
                    (MeddraTerm.llt_name.ilike(f"{q}%"), 2),
                    else_=3
                ),
                MeddraTerm.pt_name
            )
            .limit(limit)
            .all()
        )

        return jsonify([t.to_dict() for t in results])

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- GET /api/meddra/pt/<code> — fetch full hierarchy for a PT code ----------
@app.route("/api/meddra/pt/<pt_code>", methods=["GET"])
def get_meddra_pt(pt_code):
    """
    Returns the first current LLT for a given PT code, with full hierarchy.
    Used by the E2B XML builder and the Medical Review coding panel to resolve
    a stored PT code back to its display names.
    """
    try:
        term = (
            MeddraTerm.query
            .filter_by(pt_code=pt_code, current_llt="Y")
            .first()
        )
        if term is None:
            return jsonify({"error": f"PT code {pt_code} not found in MedDRA 28.1"}), 404
        return jsonify(term.to_dict())
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
