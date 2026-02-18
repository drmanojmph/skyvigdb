import os
import sys
import logging
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import text
from datetime import datetime
import uuid

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
logger.info("=== APP STARTING ===")

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

database_url = os.environ.get('DATABASE_URL', '')
if not database_url:
    logger.error("DATABASE_URL is not set!")
    sys.exit(1)

# Fix for Supabase/older Heroku-style URLs
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
}

logger.info("Config loaded")

# Initialize extensions
db = SQLAlchemy(app)
logger.info("DB initialized")

# CORS
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Models
class Case(db.Model):
    # General
    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(50), unique=True, nullable=False)
    receipt_date = db.Column(db.DateTime)
    seriousness = db.Column(db.String(20), default='non-serious')
    case_type = db.Column(db.String(50))
    current_status = db.Column(db.String(50), default='data-entry')
    
    # Patient
    patient_initials = db.Column(db.String(10))
    patient_age = db.Column(db.Integer)
    age_unit = db.Column(db.String(10))
    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(20))
    weight = db.Column(db.Float)
    weight_unit = db.Column(db.String(10))
    height = db.Column(db.Float)
    height_unit = db.Column(db.String(10))
    medical_history = db.Column(db.Text)
    concurrent_conditions = db.Column(db.Text)
    
    # Product
    product_name = db.Column(db.String(200))
    generic_name = db.Column(db.String(200))
    manufacturer = db.Column(db.String(200))
    lot_number = db.Column(db.String(100))
    expiry_date = db.Column(db.Date)
    dose = db.Column(db.String(50))
    dose_unit = db.Column(db.String(20))
    frequency = db.Column(db.String(50))
    route = db.Column(db.String(50))
    therapy_start_date = db.Column(db.Date)
    therapy_stop_date = db.Column(db.Date)
    indication = db.Column(db.String(200))
    action_taken = db.Column(db.String(50))
    
    # Event
    event_description = db.Column(db.Text)
    onset_date = db.Column(db.Date)
    stop_date = db.Column(db.Date)
    outcome = db.Column(db.String(50))
    seriousness_criteria = db.Column(db.JSON)  # Store as array
    
    # Reporter
    reporter_type = db.Column(db.String(50))
    reporter_name = db.Column(db.String(100))
    reporter_address = db.Column(db.Text)
    reporter_phone = db.Column(db.String(50))
    reporter_email = db.Column(db.String(100))
    reporter_country = db.Column(db.String(100))
    
    # Study
    study_number = db.Column(db.String(100))
    study_type = db.Column(db.String(50))
    center_id = db.Column(db.String(50))
    
    # Narrative
    case_narrative = db.Column(db.Text)
    company_remarks = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
# Initialize database on startup
def init_database():
    with app.app_context():
        try:
            db.create_all()
            logger.info("Database tables created")

            if not User.query.first():
                users = [
                    ('demo', 'demo123', 'student', 'Demo'),
                    ('admin', 'admin123', 'admin', 'Admin'),
                ]
                for username, password, role, fname in users:
                    user = User(
                        username=username,
                        password_hash=generate_password_hash(password),
                        role=role,
                        first_name=fname
                    )
                    db.session.add(user)
                db.session.commit()
                logger.info("Demo users created!")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Database init error: {e}")
            raise

try:
    init_database()
except Exception as e:
    logger.error(f"Failed to init DB on startup: {e}")
    # Don't exit - let the app start and handle DB errors per request

# Routes
@app.route('/')
def index():
    return jsonify({'message': 'SkyVigDB API', 'version': '1.0'})

@app.route('/health')
def health_check():
    try:
        db.session.execute(text('SELECT 1'))
        return jsonify({'status': 'healthy', 'service': 'SkyVigDB', 'version': '1.0'})
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({'status': 'unhealthy', 'service': 'SkyVigDB', 'db_error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    try:
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            return jsonify({
                'success': True,
                'user': {'id': user.id, 'username': user.username, 'role': user.role}
            })
        return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Database error', 'message': str(e)}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student')
    first_name = data.get('first_name', '')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    try:
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409
        
        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            role=role,
            first_name=first_name
        )
        db.session.add(user)
        db.session.commit()
        logger.info(f"New user registered: {username}")
        return jsonify({
            'success': True, 
            'message': 'User created successfully',
            'user': {'id': user.id, 'username': user.username, 'role': user.role}
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Database error', 'message': str(e)}), 500

@app.route('/api/cases', methods=['GET'])
def get_cases():
    try:
        cases = Case.query.all()
        return jsonify([{
            'id': c.id,
            'case_number': c.case_number,
            'current_status': c.current_status
        } for c in cases])
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': 'Database error'}), 500

@app.route('/api/cases', methods=['POST'])
def create_case():
    try:
        case_number = f"SV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        case = Case(case_number=case_number)
        db.session.add(case)
        db.session.commit()
        return jsonify({'success': True, 'case': {'id': case.id, 'case_number': case_number}})
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': 'Database error'}), 500

logger.info("=== APP LOADED SUCCESSFULLY ===")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    logger.info(f"Starting server on port {port}")
    app.run(host='0.0.0.0', port=port)
