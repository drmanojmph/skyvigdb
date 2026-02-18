import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [view, setView] = useState('list'); // 'list', 'new', 'detail'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Form state for new case
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    patientGender: '',
    incidentDate: '',
    incidentLocation: '',
    incidentType: '',
    description: '',
    injuries: '',
    medicalHistory: '',
    medications: '',
    allergies: '',
    vitalSigns: '',
    triageLevel: 'green',
    notes: ''
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('skyvigdb_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      fetchCases();
    }
  }, []);

  const login = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password
      });
      const userData = response.data.user;
      setUser(userData);
      localStorage.setItem('skyvigdb_user', JSON.stringify(userData));
      setError('');
      fetchCases();
    } catch (err) {
      setError('Invalid username or password');
    }
  };

  const logout = () => {
    setUser(null);
    setCases([]);
    localStorage.removeItem('skyvigdb_user');
    setUsername('');
    setPassword('');
    setView('list');
  };

  const fetchCases = async () => {
    try {
      const response = await axios.get(`${API_URL}/cases`);
      setCases(response.data);
    } catch (err) {
      console.error('Failed to fetch cases');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const submitCase = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/cases`, formData);
      setFormData({
        patientName: '',
        patientAge: '',
        patientGender: '',
        incidentDate: '',
        incidentLocation: '',
        incidentType: '',
        description: '',
        injuries: '',
        medicalHistory: '',
        medications: '',
        allergies: '',
        vitalSigns: '',
        triageLevel: 'green',
        notes: ''
      });
      setView('list');
      fetchCases();
    } catch (err) {
      console.error('Failed to create case');
    }
  };

  // Styles
  const loginContainerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #667eea 100%)',
  };

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.95)',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    width: '100%',
    maxWidth: '400px',
  };

  const dashboardStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    background: '#f5f7fa',
    minHeight: '100vh'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const buttonStyle = {
    padding: '10px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginRight: '10px'
  };

  const formStyle = {
    background: 'white',
    padding: '30px',
    borderRadius: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    margin: '5px 0 15px 0',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px'
  };

  const labelStyle = {
    fontWeight: 'bold',
    color: '#333',
    display: 'block',
    marginBottom: '5px'
  };

  const sectionStyle = {
    marginBottom: '25px',
    padding: '20px',
    background: '#f8f9fa',
    borderRadius: '8px',
    borderLeft: '4px solid #667eea'
  };

  const sectionTitleStyle = {
    color: '#1e3c72',
    marginBottom: '15px',
    fontSize: '18px',
    fontWeight: 'bold'
  };

  if (!user) {
    return (
      <div style={loginContainerStyle}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '3rem', color: '#ffffff', margin: '0 0 10px 0' }}>SkyVigilance</h1>
          <p style={{ color: '#a8c0ff', margin: 0 }}>Safety Database Management System</p>
          <p style={{ color: '#ffffff', opacity: 0.8, fontSize: '0.9rem', fontStyle: 'italic' }}>
            A VigiServe Foundation Initiative
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>Welcome Back</h2>
          {error && <div style={{ color: '#e74c3c', textAlign: 'center', marginBottom: '20px' }}>{error}</div>}
          <form onSubmit={login}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ ...inputStyle, marginBottom: '15px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, marginBottom: '20px' }}
            />
            <button type="submit" style={{ ...buttonStyle, width: '100%', padding: '15px' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // NEW CASE FORM VIEW
  if (view === 'new') {
    return (
      <div style={dashboardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>New Case Entry</p>
          </div>
          <div>
            <button onClick={() => setView('list')} style={{ ...buttonStyle, background: '#6c757d' }}>
              ← Back to List
            </button>
            <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545' }}>
              Logout
            </button>
          </div>
        </div>

        <form onSubmit={submitCase} style={formStyle}>
          {/* PATIENT INFORMATION */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>👤 Patient Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Age</label>
                <input
                  type="number"
                  name="patientAge"
                  value={formData.patientAge}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Gender</label>
                <select
                  name="patientGender"
                  value={formData.patientGender}
                  onChange={handleInputChange}
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* INCIDENT DETAILS */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>⚠️ Incident Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Date & Time</label>
                <input
                  type="datetime-local"
                  name="incidentDate"
                  value={formData.incidentDate}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  name="incidentLocation"
                  value={formData.incidentLocation}
                  onChange={handleInputChange}
                  style={inputStyle}
                  placeholder="e.g., Building A, Floor 3"
                />
              </div>
            </div>
            <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Incident Type</label>
              <select
                name="incidentType"
                value={formData.incidentType}
                onChange={handleInputChange}
                style={inputStyle}
              >
                <option value="">Select Type</option>
                <option value="fall">Fall</option>
                <option value="collision">Collision</option>
                <option value="exposure">Chemical Exposure</option>
                <option value="fire">Fire/Burn</option>
                <option value="electrical">Electrical</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                style={{ ...inputStyle, height: '80px' }}
                placeholder="Describe what happened..."
              />
            </div>
          </div>

          {/* MEDICAL INFORMATION */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>🏥 Medical Information</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Injuries Sustained</label>
              <textarea
                name="injuries"
                value={formData.injuries}
                onChange={handleInputChange}
                style={{ ...inputStyle, height: '60px' }}
                placeholder="List all injuries..."
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={labelStyle}>Medical History</label>
                <input
                  type="text"
                  name="medicalHistory"
                  value={formData.medicalHistory}
                  onChange={handleInputChange}
                  style={inputStyle}
                  placeholder="e.g., Diabetes, Hypertension"
                />
              </div>
              <div>
                <label style={labelStyle}>Current Medications</label>
                <input
                  type="text"
                  name="medications"
                  value={formData.medications}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ marginTop: '15px' }}>
              <label style={labelStyle}>Allergies</label>
              <input
                type="text"
                name="allergies"
                value={formData.allergies}
                onChange={handleInputChange}
                style={inputStyle}
                placeholder="e.g., Penicillin, Latex"
              />
            </div>
          </div>

          {/* TRIAGE ASSESSMENT */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>🚨 Triage Assessment</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Vital Signs</label>
              <input
                type="text"
                name="vitalSigns"
                value={formData.vitalSigns}
                onChange={handleInputChange}
                style={inputStyle}
                placeholder="BP: ___ HR: ___ RR: ___ Temp: ___ O2Sat: ___"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Triage Level *</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                {[
                  { value: 'red', label: '🔴 Immediate', color: '#dc3545' },
                  { value: 'yellow', label: '🟨 Delayed', color: '#ffc107' },
                  { value: 'green', label: '🟩 Minor', color: '#28a745' },
                  { value: 'black', label: '⬛ Deceased', color: '#343a40' }
                ].map(level => (
                  <label key={level.value} style={{ 
                    padding: '10px 20px', 
                    borderRadius: '5px',
                    background: formData.triageLevel === level.value ? level.color : '#f0f0f0',
                    color: formData.triageLevel === level.value ? 'white' : '#333',
                    cursor: 'pointer',
                    border: `2px solid ${level.color}`
                  }}>
                    <input
                      type="radio"
                      name="triageLevel"
                      value={level.value}
                      checked={formData.triageLevel === level.value}
                      onChange={handleInputChange}
                      style={{ marginRight: '5px' }}
                    />
                    {level.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Additional Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                style={{ ...inputStyle, height: '80px' }}
                placeholder="Any additional observations or actions taken..."
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
            <button type="submit" style={{ ...buttonStyle, flex: 1, padding: '15px', fontSize: '16px' }}>
              💾 Save Case
            </button>
            <button type="button" onClick={() => setView('list')} style={{ 
              ...buttonStyle, 
              flex: 1, 
              background: '#6c757d',
              padding: '15px',
              fontSize: '16px'
            }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // CASE LIST VIEW (Default)
  return (
    <div style={dashboardStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
          <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>VigiServe Foundation</p>
        </div>
        <div>
          <span style={{ marginRight: '20px', color: '#666' }}>
            Welcome, <strong>{user.username}</strong> ({user.role})
          </span>
          <button onClick={() => setView('new')} style={buttonStyle}>
            + New Case
          </button>
          <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545' }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Recent Cases ({cases.length})</h2>
        
        {cases.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
            No cases yet. Click "New Case" to create one.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Case #</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Patient</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Triage</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{c.case_number}</td>
                  <td style={{ padding: '12px' }}>{c.patient_name || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: c.triage_level === 'red' ? '#dc3545' : 
                                c.triage_level === 'yellow' ? '#ffc107' :
                                c.triage_level === 'green' ? '#28a745' : '#6c757d',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {c.triage_level?.toUpperCase() || 'GREEN'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{c.current_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
