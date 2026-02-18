from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime
import os
import uuid

# ============================================================================
# APP INITIALIZATION
# ============================================================================

app = Flask(__name__)

# ============================================================================
# DATABASE CONFIGURATION - Production Ready for Render
# ============================================================================

# Get database URL from environment (Render provides this) or use local SQLite
database_url = os.getenv('DATABASE_URL', 'sqlite:///training_cases.db')

# Handle Render's postgres:// vs postgresql:// prefix issue
# Render uses postgres:// but SQLAlchemy requires postgresql://
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Critical for Render free tier: connection pool settings
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,      # Test connection before using (prevents cold start errors)
    'pool_recycle': 300,        # Recycle connections every 5 minutes (300 seconds)
    'pool_size': 5,             # Maintain 5 connections in pool
    'max_overflow': 10,         # Allow up to 10 extra connections during peak load
}

# Add PostgreSQL-specific connect args if using PostgreSQL
if 'postgresql' in database_url:
    app.config['SQLALCHEMY_ENGINE_OPTIONS']['connect_args'] = {
        'connect_timeout': 10,
        'options': '-c statement_timeout=30000'  # 30 second query timeout
    }

# ============================================================================
# OTHER CONFIGURATION
# ============================================================================

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-for-production')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')

# Initialize extensions
db = SQLAlchemy(app)

# CORS configuration - ADD YOUR FRONTEND DOMAIN HERE
cors_origins = [
    'http://localhost:3000',
    'https://safetydb.skyvigilance.com',  # YOUR FRONTEND - ADD THIS
    'https://*.vercel.app'
]

# Or use this for testing (allows all origins - less secure)
# CORS(app, supports_credentials=True)

CORS(app, 
     supports_credentials=True, 
     origins=cors_origins,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Origin"])

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # triage, dataentry, medical, quality
    full_name = db.Column(db.String(100))
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Case(db.Model):
    id = db.Column(db.String(20), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(50))
    
    # Workflow State
    current_step = db.Column(db.String(20), default='triage')  # triage, dataentry, medical, quality, completed
    assigned_to = db.Column(db.String(50))
    
    # Triage Data (Step 1 - Minimum 4 criteria)
    reporter_name = db.Column(db.String(100))
    patient_initials = db.Column(db.String(10))
    product_name = db.Column(db.String(200))
    event_description = db.Column(db.Text)
    
    # Data Entry (Step 2)
    patient_age = db.Column(db.Integer)
    patient_gender = db.Column(db.String(10))
    patient_dob = db.Column(db.String(20))
    reporter_type = db.Column(db.String(50))
    reporter_country = db.Column(db.String(50))
    product_indication = db.Column(db.String(200))
    onset_date = db.Column(db.String(20))
    seriousness_criteria = db.Column(db.JSON, default=list)
    
    # Medical Review (Step 3)
    medical_assessment = db.Column(db.Text)
    causality_assessment = db.Column(db.String(50))
    listedness = db.Column(db.String(20))
    outcome = db.Column(db.String(50))
    reviewed_by = db.Column(db.String(50))
    reviewed_at = db.Column(db.DateTime)
    
    # Quality Review (Step 4)
    qc_notes = db.Column(db.Text)
    data_quality_score = db.Column(db.Integer)
    qc_passed = db.Column(db.Boolean, default=False)
    qc_by = db.Column(db.String(50))
    qc_at = db.Column(db.DateTime)
    
    # Final Status
    is_completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'currentStep': self.current_step,
            'assignedTo': self.assigned_to,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            
            # Triage
            'triage': {
                'reporterName': self.reporter_name,
                'patientInitials': self.patient_initials,
                'productName': self.product_name,
                'eventDescription': self.event_description
            },
            
            # Data Entry
            'dataEntry': {
                'patientAge': self.patient_age,
                'patientGender': self.patient_gender,
                'patientDob': self.patient_dob,
                'reporterType': self.reporter_type,
                'reporterCountry': self.reporter_country,
                'productIndication': self.product_indication,
                'onsetDate': self.onset_date,
                'seriousnessCriteria': self.seriousness_criteria or []
            },
            
            # Medical Review
            'medicalReview': {
                'assessment': self.medical_assessment,
                'causality': self.causality_assessment,
                'listedness': self.listedness,
                'outcome': self.outcome,
                'reviewedBy': self.reviewed_by,
                'reviewedAt': self.reviewed_at.isoformat() if self.reviewed_at else None
            },
            
            # Quality Review
            'qualityReview': {
                'notes': self.qc_notes,
                'qualityScore': self.data_quality_score,
                'passed': self.qc_passed,
                'reviewedBy': self.qc_by,
                'reviewedAt': self.qc_at.isoformat() if self.qc_at else None
            },
            
            'isCompleted': self.is_completed
        }

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.String(20), db.ForeignKey('case.id'))
    action = db.Column(db.String(50))
    user = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)

# ============================================================================
# INITIALIZATION
# ============================================================================

def init_training_data():
    """Create default users for training if they don't exist."""
    with app.app_context():
        db.create_all()
        
        # Create 4 training users if they don't exist
        training_users = [
            {'username': 'triage1', 'password': 'train123', 'role': 'triage', 'name': 'Triage Trainee'},
            {'username': 'dataentry1', 'password': 'train123', 'role': 'dataentry', 'name': 'Data Entry Trainee'},
            {'username': 'medical1', 'password': 'train123', 'role': 'medical', 'name': 'Medical Reviewer Trainee'},
            {'username': 'quality1', 'password': 'train123', 'role': 'quality', 'name': 'Quality Reviewer Trainee'},
        ]
        
        for u in training_users:
            if not User.query.filter_by(username=u['username']).first():
                user = User(
                    username=u['username'],
                    password_hash=generate_password_hash(u['password']),
                    role=u['role'],
                    full_name=u['name']
                )
                db.session.add(user)
                print(f"Created user: {u['username']} / {u['password']}")
        
        db.session.commit()

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Verify database connectivity."""
    try:
        # Test database connection
        db.session.execute('SELECT 1')
        db_status = 'connected'
    except Exception as e:
        db_status = f'error: {str(e)}'
    
    return jsonify({
        'status': 'ok',
        'database': db_status,
        'timestamp': datetime.utcnow().isoformat()
    })

# ============================================================================
# AUTHENTICATION ROUTES
# ============================================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    
    if user and user.check_password(data.get('password')):
        session['user_id'] = user.id
        session['username'] = user.username
        session['role'] = user.role
        session['full_name'] = user.full_name
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'role': user.role,
                'fullName': user.full_name
            }
        })
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    if 'user_id' in session:
        return jsonify({
            'id': session['user_id'],
            'username': session['username'],
            'role': session['role'],
            'fullName': session.get('full_name')
        })
    return jsonify({'message': 'Not logged in'}), 401

# ============================================================================
# CASE MANAGEMENT ROUTES
# ============================================================================

@app.route('/api/cases', methods=['GET'])
def get_cases():
    """Get cases filtered by user's role and workflow step."""
    if 'role' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_role = session['role']
    
    # Filter cases based on role
    if user_role == 'triage':
        # Triage sees cases in triage or newly created
        cases = Case.query.filter(Case.current_step.in_(['triage', 'new'])).all()
    elif user_role == 'dataentry':
        # Data entry sees cases assigned to them or in dataentry step
        cases = Case.query.filter(
            (Case.current_step == 'dataentry') | 
            (Case.assigned_to == session['username'])
        ).all()
    elif user_role == 'medical':
        cases = Case.query.filter(Case.current_step == 'medical').all()
    elif user_role == 'quality':
        cases = Case.query.filter(Case.current_step == 'quality').all()
    else:
        cases = Case.query.all()
    
    return jsonify([c.to_dict() for c in cases])

@app.route('/api/cases/<case_id>', methods=['GET'])
def get_case(case_id):
    """Get single case details."""
    case = Case.query.get_or_404(case_id)
    return jsonify(case.to_dict())

@app.route('/api/cases', methods=['POST'])
def create_case():
    """Step 1: Triage - Create case with minimum 4 criteria."""
    if session.get('role') != 'triage':
        return jsonify({'error': 'Only triage users can create cases'}), 403
    
    data = request.get_json()
    
    # Validate minimum 4 criteria
    required = ['reporterName', 'patientInitials', 'productName', 'eventDescription']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({'error': f'Missing required fields: {missing}'}), 400
    
    # Generate case ID: PV-YYYYMMDD-XXXX
    today = datetime.now().strftime('%Y%m%d')
    count = Case.query.filter(Case.id.like(f'PV-{today}-%')).count() + 1
    case_id = f'PV-{today}-{count:04d}'
    
    case = Case(
        id=case_id,
        created_by=session['username'],
        current_step='dataentry',
        assigned_to=None,  # Will be assigned to data entry trainee
        
        # Triage data
        reporter_name=data['reporterName'],
        patient_initials=data['patientInitials'],
        product_name=data['productName'],
        event_description=data['eventDescription']
    )
    
    db.session.add(case)
    
    # Log action
    audit = AuditLog(
        case_id=case_id,
        action='CASE_CREATED',
        user=session['username'],
        details='Case created via triage'
    )
    db.session.add(audit)
    db.session.commit()
    
    return jsonify(case.to_dict()), 201

@app.route('/api/cases/<case_id>/dataentry', methods=['PUT'])
def update_data_entry(case_id):
    """Step 2: Data Entry - Complete case details."""
    if session.get('role') != 'dataentry':
        return jsonify({'error': 'Only data entry users can perform this action'}), 403
    
    case = Case.query.get_or_404(case_id)
    
    if case.current_step != 'dataentry':
        return jsonify({'error': 'Case not in data entry step'}), 400
    
    data = request.get_json()
    
    # Update data entry fields
    case.patient_age = data.get('patientAge')
    case.patient_gender = data.get('patientGender')
    case.patient_dob = data.get('patientDob')
    case.reporter_type = data.get('reporterType')
    case.reporter_country = data.get('reporterCountry')
    case.product_indication = data.get('productIndication')
    case.onset_date = data.get('onsetDate')
    case.seriousness_criteria = data.get('seriousnessCriteria', [])
    
    # Move to medical review
    case.current_step = 'medical'
    case.assigned_to = None
    
    # Log action
    audit = AuditLog(
        case_id=case_id,
        action='DATA_ENTRY_COMPLETED',
        user=session['username']
    )
    db.session.add(audit)
    db.session.commit()
    
    return jsonify(case.to_dict())

@app.route('/api/cases/<case_id>/medical', methods=['PUT'])
def update_medical_review(case_id):
    """Step 3: Medical Review - Assess case."""
    if session.get('role') != 'medical':
        return jsonify({'error': 'Only medical users can perform this action'}), 403
    
    case = Case.query.get_or_404(case_id)
    
    if case.current_step != 'medical':
        return jsonify({'error': 'Case not in medical review step'}), 400
    
    data = request.get_json()
    
    case.medical_assessment = data.get('assessment')
    case.causality_assessment = data.get('causality')
    case.listedness = data.get('listedness')
    case.outcome = data.get('outcome')
    case.reviewed_by = session['username']
    case.reviewed_at = datetime.utcnow()
    
    # Move to quality review
    case.current_step = 'quality'
    
    # Log action
    audit = AuditLog(
        case_id=case_id,
        action='MEDICAL_REVIEW_COMPLETED',
        user=session['username']
    )
    db.session.add(audit)
    db.session.commit()
    
    return jsonify(case.to_dict())

@app.route('/api/cases/<case_id>/quality', methods=['PUT'])
def update_quality_review(case_id):
    """Step 4: Quality Review - Final check."""
    if session.get('role') != 'quality':
        return jsonify({'error': 'Only quality users can perform this action'}), 403
    
    case = Case.query.get_or_404(case_id)
    
    if case.current_step != 'quality':
        return jsonify({'error': 'Case not in quality review step'}), 400
    
    data = request.get_json()
    
    case.qc_notes = data.get('notes')
    case.data_quality_score = data.get('qualityScore')
    case.qc_passed = data.get('passed', False)
    case.qc_by = session['username']
    case.qc_at = datetime.utcnow()
    
    if case.qc_passed:
        case.current_step = 'completed'
        case.is_completed = True
        case.completed_at = datetime.utcnow()
    else:
        # Send back to data entry if failed
        case.current_step = 'dataentry'
    
    # Log action
    audit = AuditLog(
        case_id=case_id,
        action='QUALITY_REVIEW_COMPLETED',
        user=session['username'],
        details=f'QC Passed: {case.qc_passed}'
    )
    db.session.add(audit)
    db.session.commit()
    
    return jsonify(case.to_dict())

@app.route('/api/cases/<case_id>/assign', methods=['POST'])
def assign_case(case_id):
    """Assign case to specific user."""
    case = Case.query.get_or_404(case_id)
    data = request.get_json()
    
    case.assigned_to = data.get('username')
    db.session.commit()
    
    return jsonify(case.to_dict())

@app.route('/api/cases/<case_id>/audit', methods=['GET'])
def get_audit_log(case_id):
    """Get audit trail for case."""
    logs = AuditLog.query.filter_by(case_id=case_id).order_by(AuditLog.timestamp.desc()).all()
    return jsonify([{
        'action': l.action,
        'user': l.user,
        'timestamp': l.timestamp.isoformat(),
        'details': l.details
    } for l in logs])

# ============================================================================
# DASHBOARD & STATS
# ============================================================================

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Get dashboard statistics."""
    if 'role' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user_role = session['role']
    
    stats = {
        'totalCases': Case.query.count(),
        'inTriage': Case.query.filter_by(current_step='triage').count(),
        'inDataEntry': Case.query.filter_by(current_step='dataentry').count(),
        'inMedicalReview': Case.query.filter_by(current_step='medical').count(),
        'inQualityReview': Case.query.filter_by(current_step='quality').count(),
        'completed': Case.query.filter_by(is_completed=True).count(),
        'myCases': Case.query.filter_by(assigned_to=session['username']).count()
    }
    
    return jsonify(stats)

# ============================================================================
# RUN
# ============================================================================

if __name__ == '__main__':
    init_training_data()
    app.run(debug=True, port=5000)
