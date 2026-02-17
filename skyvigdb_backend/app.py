import os
import logging
from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import uuid

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
database_url = os.environ.get('DATABASE_URL', 'sqlite:///tmp/skyvigdb.db')
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

logger.info(f"Starting SkyVigDB with DB: {database_url}")

# Initialize extensions
db = SQLAlchemy(app)

# CORS - Allow all origins for API routes
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
    }
})

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default='student')
    first_name = db.Column(db.String(50))

class Case(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(50), unique=True, nullable=False)
    current_status = db.Column(db.String(50), default='triage')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Initialize database on startup - WITH ERROR HANDLING
def init_database():
    with app.app_context():
        try:
            db.create_all()
            logger.info("Database tables created")
            
            # Seed demo users if empty
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
            # Don't raise - let app start anyway

# Call it but don't crash if it fails
try:
    init_database()
except Exception as e:
    logger.error(f"Failed to init DB on startup: {e}")

# Routes
@app.route('/health')
def health_check():
    try:
        # Test DB connection
        db.session.execute('SELECT 1')
        return jsonify({'status': 'healthy', 'service': 'SkyVigDB', 'version': '1.0'})
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/')
def index():
    return jsonify({'message': 'SkyVigDB API', 'version': '1.0'})

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
        return jsonify({'error': 'Database error'}), 500

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=False, host='0.0.0.0', port=port)
