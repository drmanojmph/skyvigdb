"""
SkyVigDB - Production Version with Concurrent User Support
Multiple users can log in with same credentials simultaneously
"""

import os
import logging
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, session
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, current_user
from flask_cors import CORS
from flask_session import Session  # Server-side sessions
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import xml.etree.ElementTree as ET
from xml.dom import minidom
import redis  # For session storage (optional, can use filesystem)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder='templates')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS'] = False

# Session Configuration - CRITICAL for concurrent users
app.config['SESSION_TYPE'] = 'filesystem'  # Options: 'filesystem', 'redis', 'sqlalchemy'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_PREFIX'] = 'skyvigdb_session:'
app.config['SESSION_FILE_DIR'] = '/tmp/flask_sessions'  # For filesystem sessions

# Create session directory if using filesystem
if app.config['SESSION_TYPE'] == 'filesystem':
    os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)

# Initialize extensions
db = SQLAlchemy(app)
Session(app)  # Initialize server-side sessions

# Custom Login Manager for concurrent sessions
class ConcurrentLoginManager:
    def __init__(self):
        self.active_sessions = {}  # user_id -> list of session_ids
    
    def login_user(self, user, session_id):
        """Log in user with new session"""
        if user.id not in self.active_sessions:
            self.active_sessions[user.id] = []
        self.active_sessions[user.id].append({
            'session_id': session_id,
            'login_time': datetime.utcnow(),
            'ip_address': request.remote_addr,
            'user_agent': request.user_agent.string[:100] if request.user_agent else 'Unknown'
        })
        logger.info(f"User {user.username} logged in. Active sessions: {len(self.active_sessions[user.id])}")
        return True
    
    def logout_user(self, user_id, session_id):
        """Log out specific session"""
        if user_id in self.active_sessions:
            self.active_sessions[user_id] = [
                s for s in self.active_sessions[user_id] 
                if s['session_id'] != session_id
            ]
            if not self.active_sessions[user_id]:
                del self.active_sessions[user_id]
        logger.info(f"User {user_id} session {session_id[:8]}... logged out")
    
    def get_active_sessions(self, user_id):
        """Get all active sessions for user"""
        return self.active_sessions.get(user_id, [])
    
    def is_session_valid(self, user_id, session_id):
        """Check if session is still valid"""
        if user_id not in self.active_sessions:
            return False
        return any(s['session_id'] == session_id for s in self.active_sessions[user_id])

concurrent_login_manager = ConcurrentLoginManager()

# CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "https://www.skyvigilance.com",
            "https://skyvigilance.com",
            "http://localhost:3000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True
    }
})

# ============== DATABASE MODELS ==============

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    max_concurrent_sessions = db.Column(db.Integer, default=50)  # Limit per user
    
    # Track login statistics
    total_logins = db.Column(db.Integer, default=0)
    last_login = db.Column(db.DateTime)
    
    def get_id(self):
        """Override to return unique session identifier"""
        return f"{self.id}:{session.get('session_id', 'unknown')}"

class SessionLog(db.Model):
    """Log all login/logout activities"""
    __tablename__ = 'session_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_id = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(20))  # 'login', 'logout', 'expired'
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(255))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='session_logs')

class Case(db.Model):
    __tablename__ = 'cases'
    
    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(50), unique=True, nullable=False)
    worldwide_id = db.Column(db.String(100), unique=True)
    current_status = db.Column(db.String(50), default='triage')
    priority = db.Column(db.String(20), default='routine')
    assigned_user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    received_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Patient Information
    patient_initials = db.Column(db.String(10))
    patient_country = db.Column(db.String(3))
    patient_birth_date = db.Column(db.Date)
    patient_age = db.Column(db.Float)
    patient_age_unit = db.Column(db.String(10))
    patient_sex = db.Column(db.String(1))
    
    # Reporter Information
    reporter_given_name = db.Column(db.String(100))
    reporter_family_name = db.Column(db.String(100))
    reporter_organization = db.Column(db.String(255))
    reporter_qualification = db.Column(db.String(50))
    reporter_country = db.Column(db.String(3))
    reporter_telephone = db.Column(db.String(50))
    reporter_email = db.Column(db.String(100))
    
    # Narrative
    case_narrative = db.Column(db.Text)
    
    # Relationships
    events = db.relationship('AdverseEvent', backref='case', lazy=True, cascade='all, delete-orphan')
    drugs = db.relationship('Drug', backref='case', lazy=True, cascade='all, delete-orphan')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AdverseEvent(db.Model):
    __tablename__ = 'adverse_events'
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    reaction_term = db.Column(db.String(255))
    reaction_meddra_code = db.Column(db.String(20))
    onset_date = db.Column(db.Date)
    is_serious = db.Column(db.Boolean, default=False)
    seriousness_criteria = db.Column(db.String(255))
    outcome = db.Column(db.String(50))

class Drug(db.Model):
    __tablename__ = 'drugs'
    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('cases.id'), nullable=False)
    drug_characterization = db.Column(db.String(20))
    drug_name = db.Column(db.String(255))
    dose_number = db.Column(db.Float)
    dose_unit = db.Column(db.String(50))
    route_administration = db.Column(db.String(100))
    start_date = db.Column(db.Date)
    indication_term = db.Column(db.String(255))

# ============== AUTHENTICATION DECORATORS ==============

def login_required(f):
    """Custom login required that supports concurrent sessions"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check if session has user_id and session_id
        if 'user_id' not in session or 'session_id' not in session:
            return jsonify({'error': 'Authentication required', 'code': 'AUTH_REQUIRED'}), 401
        
        user_id = session.get('user_id')
        session_id = session.get('session_id')
        
        # Verify session is still valid in our concurrent manager
        if not concurrent_login_manager.is_session_valid(user_id, session_id):
            # Session expired or invalidated
            session.clear()
            return jsonify({'error': 'Session expired', 'code': 'SESSION_EXPIRED'}), 401
        
        # Load user
        user = User.query.get(user_id)
        if not user or not user.is_active:
            session.clear()
            return jsonify({'error': 'User not found or inactive'}), 401
        
        # Set current user
        g.current_user = user
        return f(*args, **kwargs)
    return decorated_function

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'current_user'):
                return jsonify({'error': 'Authentication required'}), 401
            if g.current_user.role not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# ============== API ROUTES ==============

from flask import g

@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy', 
        'service': 'SkyVigDB API',
        'version': '1.1.0',
        'concurrent_sessions': 'enabled'
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account disabled'}), 403
    
    # Check concurrent session limit
    active_sessions = concurrent_login_manager.get_active_sessions(user.id)
    if len(active_sessions) >= user.max_concurrent_sessions:
        logger.warning(f"User {username} reached max concurrent sessions ({user.max_concurrent_sessions})")
        return jsonify({
            'error': 'Maximum concurrent sessions reached',
            'code': 'MAX_SESSIONS',
            'active_sessions': len(active_sessions),
            'limit': user.max_concurrent_sessions
        }), 429
    
    # Generate unique session ID
    session_id = str(uuid.uuid4())
    
    # Store in Flask session
    session.permanent = True
    session['user_id'] = user.id
    session['session_id'] = session_id
    session['login_time'] = datetime.utcnow().isoformat()
    
    # Register in concurrent manager
    concurrent_login_manager.login_user(user, session_id)
    
    # Update user stats
    user.total_logins += 1
    user.last_login = datetime.utcnow()
    db.session.commit()
    
    # Log session
    session_log = SessionLog(
        user_id=user.id,
        session_id=session_id,
        action='login',
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string[:255] if request.user_agent else None
    )
    db.session.add(session_log)
    db.session.commit()
    
    logger.info(f"User {username} logged in with session {session_id[:8]}... "
                f"(Active: {len(active_sessions) + 1})")
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'session_id': session_id[:8] + '...'  # For debugging
        },
        'session_info': {
            'active_sessions': len(active_sessions) + 1,
            'max_allowed': user.max_concurrent_sessions
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    user_id = session.get('user_id')
    session_id = session.get('session_id')
    
    # Log the logout
    if user_id and session_id:
        session_log = SessionLog(
            user_id=user_id,
            session_id=session_id,
            action='logout',
            ip_address=request.remote_addr
        )
        db.session.add(session_log)
        db.session.commit()
        
        concurrent_login_manager.logout_user(user_id, session_id)
    
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/auth/sessions', methods=['GET'])
@login_required
def get_active_sessions():
    """Get all active sessions for current user"""
    user_id = g.current_user.id
    sessions = concurrent_login_manager.get_active_sessions(user_id)
    
    # Get session logs for more details
    session_logs = SessionLog.query.filter(
        SessionLog.user_id == user_id,
        SessionLog.action == 'login'
    ).order_by(SessionLog.timestamp.desc()).limit(10).all()
    
    return jsonify({
        'current_session': session.get('session_id', 'unknown')[:8] + '...',
        'active_sessions': len(sessions),
        'max_allowed': g.current_user.max_concurrent_sessions,
        'sessions': [{
            'session_id': s['session_id'][:8] + '...',
            'login_time': s['login_time'].isoformat() if isinstance(s['login_time'], datetime) else s['login_time'],
            'ip_address': s['ip_address'],
            'user_agent': s['user_agent'][:50] + '...' if len(s['user_agent']) > 50 else s['user_agent']
        } for s in sessions],
        'recent_history': [{
            'action': log.action,
            'timestamp': log.timestamp.isoformat(),
            'ip': log.ip_address
        } for log in session_logs]
    })

@app.route('/api/auth/invalidate-all-sessions', methods=['POST'])
@login_required
def invalidate_all_sessions():
    """Admin can force logout all sessions of a user"""
    if g.current_user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    
    data = request.json
    target_user_id = data.get('user_id')
    
    if not target_user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    # Clear from concurrent manager
    if target_user_id in concurrent_login_manager.active_sessions:
        del concurrent_login_manager.active_sessions[target_user_id]
    
    # Log the action
    logger.info(f"Admin {g.current_user.username} invalidated all sessions for user {target_user_id}")
    
    return jsonify({
        'success': True,
        'message': f'All sessions for user {target_user_id} invalidated'
    })

# ============== CASE MANAGEMENT ROUTES ==============

@app.route('/api/cases', methods=['GET'])
@login_required
def get_cases():
    cases = Case.query.order_by(Case.received_date.desc()).all()
    return jsonify([{
        'id': c.id,
        'case_number': c.case_number,
        'current_status': c.current_status,
        'priority': c.priority,
        'received_date': c.received_date.isoformat() if c.received_date else None,
        'patient_initials': c.patient_initials
    } for c in cases])

@app.route('/api/cases', methods=['POST'])
@login_required
@role_required(['triage', 'admin', 'data_entry'])
def create_case():
    case_number = f"SV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    case = Case(
        case_number=case_number,
        worldwide_id=str(uuid.uuid4()),
        created_by=g.current_user.id
    )
    db.session.add(case)
    db.session.commit()
    
    logger.info(f"User {g.current_user.username} created case {case_number}")
    
    return jsonify({
        'success': True,
        'case': {'id': case.id, 'case_number': case_number}
    })

@app.route('/api/cases/<int:case_id>')
@login_required
def get_case(case_id):
    case = Case.query.get_or_404(case_id)
    return jsonify({
        'id': case.id,
        'case_number': case.case_number,
        'current_status': case.current_status,
        'patient_initials': case.patient_initials,
        'events': [{'id': e.id, 'reaction_term': e.reaction_term} for e in case.events],
        'drugs': [{'id': d.id, 'drug_name': d.drug_name} for d in case.drugs]
    })

@app.route('/api/cases/<int:case_id>/generate-e2b', methods=['POST'])
@login_required
def generate_e2b(case_id):
    case = Case.query.get_or_404(case_id)
    try:
        xml_content = generate_e2b_r3_xml(case)
        logger.info(f"User {g.current_user.username} generated E2B for case {case.case_number}")
        return jsonify({'success': True, 'xml': xml_content})
    except Exception as e:
        logger.error(f"E2B Generation Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

def generate_e2b_r3_xml(case):
    """Generate E2B R3 compliant XML"""
    root = ET.Element("MCCI_IN200100UV01")
    root.set("xmlns", "urn:hl7-org:v3")
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    root.set("ITSVersion", "XML_1.0")
    
    id_elem = ET.SubElement(root, "id")
    id_elem.set("root", "2.16.840.1.113883.3.989.2.1.3.1")
    id_elem.set("extension", case.worldwide_id or str(uuid.uuid4()))
    
    creation_time = ET.SubElement(root, "creationTime")
    creation_time.set("value", datetime.now().strftime("%Y%m%d%H%M%S"))
    
    # ... (rest of XML generation as before)
    
    rough_string = ET.tostring(root, encoding='unicode')
    reparsed = minidom.parseString(rough_string)
    return reparsed.toprettyxml(indent="  ")

@app.route('/api/dashboard/stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    total = Case.query.count()
    by_status = db.session.query(Case.current_status, db.func.count(Case.id)).group_by(Case.current_status).all()
    
    # Get online users (unique users with active sessions)
    online_users = len(concurrent_login_manager.active_sessions)
    
    return jsonify({
        'total_cases': total,
        'online_users': online_users,
        'workflow': {status: count for status, count in by_status},
        'recent_cases': []
    })

# ============== ADMIN ROUTES ==============

@app.route('/api/admin/users', methods=['GET'])
@login_required
@role_required(['admin'])
def list_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'role': u.role,
        'is_active': u.is_active,
        'max_concurrent_sessions': u.max_concurrent_sessions,
        'total_logins': u.total_logins,
        'last_login': u.last_login.isoformat() if u.last_login else None,
        'active_sessions': len(concurrent_login_manager.get_active_sessions(u.id))
    } for u in users])

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@login_required
@role_required(['admin'])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    
    if 'max_concurrent_sessions' in data:
        user.max_concurrent_sessions = data['max_concurrent_sessions']
    
    if 'is_active' in data:
        user.is_active = data['is_active']
        # If deactivating, invalidate all sessions
        if not user.is_active and user.id in concurrent_login_manager.active_sessions:
            del concurrent_login_manager.active_sessions[user.id]
    
    db.session.commit()
    return jsonify({'success': True, 'message': 'User updated'})

@app.route('/api/admin/system-status', methods=['GET'])
@login_required
@role_required(['admin'])
def system_status():
    """Get system-wide status including all active sessions"""
    total_sessions = sum(len(sessions) for sessions in concurrent_login_manager.active_sessions.values())
    
    return jsonify({
        'total_active_sessions': total_sessions,
        'unique_active_users': len(concurrent_login_manager.active_sessions),
        'session_details': {
            user_id: {
                'username': User.query.get(user_id).username if User.query.get(user_id) else 'Unknown',
                'session_count': len(sessions),
                'sessions': [{
                    'login_time': s['login_time'].isoformat() if isinstance(s['login_time'], datetime) else s['login_time'],
                    'ip': s['ip_address']
                } for s in sessions]
            }
            for user_id, sessions in concurrent_login_manager.active_sessions.items()
        }
    })

# ============== INITIALIZATION ==============

@app.cli.command('init-db')
def init_db():
    """Initialize database with demo data supporting concurrent users"""
    db.create_all()
    
    if not User.query.filter_by(username='admin').first():
        users_data = [
            ('admin', 'admin@skyvigilance.com', 'admin123', 'admin', 'System', 'Admin', 100),
            ('triage1', 'triage@skyvigilance.com', 'triage123', 'triage', 'Triage', 'User', 50),
            ('dataentry1', 'data@skyvigilance.com', 'dataentry123', 'data_entry', 'Data', 'Entry', 50),
            ('medical1', 'medical@skyvigilance.com', 'medical123', 'medical_review', 'Medical', 'Reviewer', 30),
            ('qc1', 'qc@skyvigilance.com', 'qc123', 'quality_review', 'Quality', 'Reviewer', 30),
            ('student1', 'student@skyvigilance.com', 'student123', 'student', 'Student', 'User', 100),
            ('demo', 'demo@skyvigilance.com', 'demo123', 'student', 'Demo', 'Account', 200),  # High limit for demos
        ]
        
        for username, email, password, role, fname, lname, max_sessions in users_data:
            user = User(
                username=username,
                email=email,
                password_hash=generate_password_hash(password),
                role=role,
                first_name=fname,
                last_name=lname,
                max_concurrent_sessions=max_sessions
            )
            db.session.add(user)
        
        db.session.commit()
        logger.info("SkyVigDB initialized with concurrent user support!")
        logger.info("Demo accounts created with session limits:")
        for username, _, _, _, _, _, limit in users_data:
            logger.info(f"  - {username}: {limit} concurrent sessions")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
