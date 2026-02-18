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
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Critical for Render free tier: connection pool settings
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_size': 5,
    'max_overflow': 10,
}

# Add PostgreSQL-specific connect args if using PostgreSQL
if 'postgresql' in database_url:
    app.config['SQLALCHEMY_ENGINE_OPTIONS']['connect_args'] = {
        'connect_timeout': 10,
        'options': '-c statement_timeout=30000'
    }

# ============================================================================
# OTHER CONFIGURATION
# ============================================================================

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-for-production')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads')

# Initialize extensions
db = SQLAlchemy(app)

# CORS - FIXED: Allow your frontend domain
CORS(app, 
     supports_credentials=True, 
     origins=['https://safetydb.skyvigilance.com', 'http://localhost:3000', 'https://*.vercel.app'],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"])

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ============================================================================
# DATABASE MODELS
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
    
    # Workflow State
    current_step = db.Column(db.Integer, default=1)
    status = db.Column(db.String(50), default='New')
    
    # Triage Data (Step 1)
    receipt_date = db.Column(db.String(20))
    reporter_name = db.Column(db.String(100))
    reporter_contact = db.Column(db.String(100))
    reporter_country = db.Column(db.String(50))
    product_name = db.Column(db.String(200))
    event_description = db.Column(db.Text)
    
    # Data Entry (Step 2)
    patient_initials = db.Column(db.String(10))
    patient_age = db.Column(db.Integer)
    patient_gender = db.Column(db.String(10))
    patient_dob = db.Column(db.String(20))
    reporter_type = db.Column(db.String(50))
    product_indication = db.Column(db.String(200))
    dose = db.Column(db.String(50))
    route = db.Column(db.String(50))
    onset_date = db.Column(db.String(20))
    outcome = db.Column(db.String(50))
    
    # Medical Review (Step 3)
    causality_assessment = db.Column(db.String(50))
    listedness = db.Column(db.String(20))
    medical_comments = db.Column(db.Text)
    
    # Quality Review (Step 4)
    completeness_check = db.Column(db.Boolean, default=False)
    consistency_check = db.Column(db.Boolean, default=False)
    regulatory_compliance = db.Column(db.Boolean, default=False)
    quality_comments = db.Column(db.Text)
    final_status = db.Column(db.String(20))
    
    def to_dict(self):
        return {
            'id': self.id,
            'caseNumber': self.id,
            'currentStep': self.current_step,
            'status': self.status,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'receiptDate': self.receipt_date,
            'reporterName': self.reporter_name,
            'reporterContact': self.reporter_contact,
            'reporterCountry': self.reporter_country,
            'productName': self.product_name,
            'eventDescription': self.event_description,
            'patientInitials': self.patient_initials,
            'causalityAssessment': self.causality_assessment,
            'listedness': self.listedness
        }

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.String(50), db.ForeignKey('case.id'))
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
                print(f"Created user: {u['username']}")
        
        db.session.commit()

# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
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
        
        return jsonify({
            'success': True,
            'user': {
                'username': user.username,
                'role': user.role
            }
        })
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

# ============================================================================
# CASE MANAGEMENT ROUTES - TRAINING MODE (No session required)
# ============================================================================

@app.route('/api/cases', methods=['GET'])
def get_cases():
    """Get all cases - TRAINING MODE."""
    try:
        cases = Case.query.all()
        return jsonify([c.to_dict() for c in cases])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cases', methods=['POST'])
def create_case():
    """Create case - TRAINING MODE (no session check)."""
    try:
        data = request.get_json()
        
        # Generate case ID
        case_id = 'PV-' + str(int(datetime.now().timestamp()))
        
        case = Case(
            id=case_id,
            created_by='triage1',
            current_step=2,
            status='Triage Complete',
            receipt_date=data.get('receiptDate'),
            reporter_name=data.get('reporterName'),
            reporter_contact=data.get('reporterContact'),
            reporter_country=data.get('reporterCountry'),
            product_name=data.get('productName'),
            event_description=data.get('eventDescription')
        )
        
        db.session.add(case)
        db.session.commit()
        
        return jsonify(case.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cases/<case_id>', methods=['PUT'])
def update_case(case_id):
    """Update case - TRAINING MODE."""
    try:
        case = Case.query.get_or_404(case_id)
        data = request.get_json()
        
        # Update fields based on current step
        if case.current_step == 2:  # Data Entry
            case.patient_initials = data.get('patientInitials')
            case.patient_age = data.get('patientAge')
            case.patient_gender = data.get('patientGender')
            case.dose = data.get('dose')
            case.route = data.get('route')
            case.current_step = 3
            case.status = 'Data Entry Complete'
            
        elif case.current_step == 3:  # Medical Review
            case.causality_assessment = data.get('causalityAssessment')
            case.listedness = data.get('listedness')
            case.medical_comments = data.get('medicalComments')
            case.current_step = 4
            case.status = 'Medical Review Complete'
            
        elif case.current_step == 4:  # Quality Review
            case.completeness_check = data.get('completenessCheck', False)
            case.consistency_check = data.get('consistencyCheck', False)
            case.regulatory_compliance = data.get('regulatoryCompliance', False)
            case.quality_comments = data.get('qualityComments')
            case.final_status = data.get('finalStatus')
            
            if data.get('finalStatus') == 'approved':
                case.current_step = 5
                case.status = 'Approved'
            else:
                case.current_step = 3
                case.status = 'Rejected - Back to Medical'
        
        db.session.commit()
        return jsonify(case.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/cases/<case_id>', methods=['GET'])
def get_case(case_id):
    """Get single case."""
    case = Case.query.get_or_404(case_id)
    return jsonify(case.to_dict())

# ============================================================================
# RUN
# ============================================================================

if __name__ == '__main__':
    init_training_data()
    app.run(debug=True, port=5000)
