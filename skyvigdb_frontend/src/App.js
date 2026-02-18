import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [view, setView] = useState('list');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  // Argus-aligned form state
  const [formData, setFormData] = useState({
    // General Information
    caseNumber: '',
    receiptDate: '',
    seriousness: 'non-serious',
    caseType: 'spontaneous',
    
    // Patient Information
    patientInitials: '',
    patientAge: '',
    ageUnit: 'years',
    dateOfBirth: '',
    gender: '',
    weight: '',
    weightUnit: 'kg',
    height: '',
    heightUnit: 'cm',
    
    // Medical History
    medicalHistory: '',
    concurrentConditions: '',
    
    // Product Information (Suspect Drug)
    productName: '',
    genericName: '',
    manufacturer: '',
    lotNumber: '',
    expiryDate: '',
    dose: '',
    doseUnit: 'mg',
    frequency: '',
    route: '',
    therapyStartDate: '',
    therapyStopDate: '',
    indication: '',
    actionTaken: 'not-applicable',
    
    // Adverse Event/Reaction
    eventDescription: '',
    onsetDate: '',
    stopDate: '',
    outcome: '',
    seriousnessCriteria: [],
    
    // Reporter Information
    reporterType: '',
    reporterName: '',
    reporterAddress: '',
    reporterPhone: '',
    reporterEmail: '',
    reporterCountry: '',
    
    // Study Information (if applicable)
    studyNumber: '',
    studyType: '',
    centerId: '',
    
    // Narrative
    caseNarrative: '',
    companyRemarks: ''
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
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      const updatedCriteria = checked 
        ? [...formData.seriousnessCriteria, value]
        : formData.seriousnessCriteria.filter(c => c !== value);
      setFormData(prev => ({ ...prev, seriousnessCriteria: updatedCriteria }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const submitCase = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/cases`, formData);
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
    maxWidth: '1400px',
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

  const tabContainerStyle = {
    display: 'flex',
    borderBottom: '2px solid #dee2e6',
    marginBottom: '20px',
    background: 'white',
    borderRadius: '10px 10px 0 0',
    overflow: 'hidden'
  };

  const tabStyle = (isActive) => ({
    padding: '15px 25px',
    background: isActive ? '#667eea' : '#f8f9fa',
    color: isActive ? 'white' : '#495057',
    border: 'none',
    cursor: 'pointer',
    fontWeight: isActive ? 'bold' : 'normal',
    borderRight: '1px solid #dee2e6'
  });

  const formStyle = {
    background: 'white',
    padding: '30px',
    borderRadius: '0 0 10px 10px',
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
    marginBottom: '5px',
    fontSize: '13px'
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
    fontSize: '16px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  const grid2Col = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
  const grid3Col = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' };
  const grid4Col = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' };

  const checkboxGroupStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '15px',
    marginTop: '10px'
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
    const renderGeneralTab = () => (
      <div>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>📋 General Information</h3>
          <div style={grid3Col}>
            <div>
              <label style={labelStyle}>Receipt Date *</label>
              <input
                type="datetime-local"
                name="receiptDate"
                value={formData.receiptDate}
                onChange={handleInputChange}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Seriousness *</label>
              <select name="seriousness" value={formData.seriousness} onChange={handleInputChange} style={inputStyle}>
                <option value="non-serious">Non-Serious</option>
                <option value="serious">Serious</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Case Type *</label>
              <select name="caseType" value={formData.caseType} onChange={handleInputChange} style={inputStyle}>
                <option value="spontaneous">Spontaneous</option>
                <option value="report-from-study">Report from Study</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>👤 Patient Information</h3>
          <div style={grid4Col}>
            <div>
              <label style={labelStyle}>Patient Initials *</label>
              <input type="text" name="patientInitials" value={formData.patientInitials} onChange={handleInputChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Age</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="number" name="patientAge" value={formData.patientAge} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} />
                <select name="ageUnit" value={formData.ageUnit} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }}>
                  <option value="years">Years</option>
                  <option value="months">Months</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Gender *</label>
              <select name="gender" value={formData.gender} onChange={handleInputChange} style={inputStyle} required>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
          <div style={{ ...grid2Col, marginTop: '15px' }}>
            <div>
              <label style={labelStyle}>Weight</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} />
                <select name="weightUnit" value={formData.weightUnit} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }}>
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Height</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="number" name="height" value={formData.height} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} />
                <select name="heightUnit" value={formData.heightUnit} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }}>
                  <option value="cm">cm</option>
                  <option value="inches">inches</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>🏥 Medical History</h3>
          <div>
            <label style={labelStyle}>Relevant Medical History</label>
            <textarea name="medicalHistory" value={formData.medicalHistory} onChange={handleInputChange} style={{ ...inputStyle, height: '80px' }} placeholder="Include all relevant medical history..." />
          </div>
          <div style={{ marginTop: '15px' }}>
            <label style={labelStyle}>Concurrent Conditions</label>
            <textarea name="concurrentConditions" value={formData.concurrentConditions} onChange={handleInputChange} style={{ ...inputStyle, height: '60px' }} placeholder="Any concurrent medical conditions..." />
          </div>
        </div>
      </div>
    );

    const renderProductTab = () => (
      <div>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>💊 Suspect Product Information</h3>
          <div style={grid2Col}>
            <div>
              <label style={labelStyle}>Product/Brand Name *</label>
              <input type="text" name="productName" value={formData.productName} onChange={handleInputChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Generic Name</label>
              <input type="text" name="genericName" value={formData.genericName} onChange={handleInputChange} style={inputStyle} />
            </div>
          </div>
          <div style={{ ...grid3Col, marginTop: '15px' }}>
            <div>
              <label style={labelStyle}>Manufacturer</label>
              <input type="text" name="manufacturer" value={formData.manufacturer} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Lot/Batch Number</label>
              <input type="text" name="lotNumber" value={formData.lotNumber} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiry Date</label>
              <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleInputChange} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>📅 Therapy Details</h3>
          <div style={grid4Col}>
            <div>
              <label style={labelStyle}>Dose *</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                <input type="text" name="dose" value={formData.dose} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} required />
                <select name="doseUnit" value={formData.doseUnit} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }}>
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="units">units</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Frequency</label>
              <input type="text" name="frequency" value={formData.frequency} onChange={handleInputChange} style={inputStyle} placeholder="e.g., BID, TID, QD" />
            </div>
            <div>
              <label style={labelStyle}>Route *</label>
              <select name="route" value={formData.route} onChange={handleInputChange} style={inputStyle} required>
                <option value="">Select</option>
                <option value="oral">Oral</option>
                <option value="iv">Intravenous</option>
                <option value="im">Intramuscular</option>
                <option value="sc">Subcutaneous</option>
                <option value="topical">Topical</option>
                <option value="inhalation">Inhalation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Indication</label>
              <input type="text" name="indication" value={formData.indication} onChange={handleInputChange} style={inputStyle} placeholder="Reason for use" />
            </div>
          </div>
          <div style={{ ...grid2Col, marginTop: '15px' }}>
            <div>
              <label style={labelStyle}>Therapy Start Date</label>
              <input type="date" name="therapyStartDate" value={formData.therapyStartDate} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Therapy Stop Date</label>
              <input type="date" name="therapyStopDate" value={formData.therapyStopDate} onChange={handleInputChange} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '15px' }}>
            <label style={labelStyle}>Action Taken with Product</label>
            <select name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} style={inputStyle}>
              <option value="not-applicable">Not Applicable</option>
              <option value="dose-reduced">Dose Reduced</option>
              <option value="dose-increased">Dose Increased</option>
              <option value="drug-withdrawn">Drug Withdrawn</option>
              <option value="not-changed">Dose Not Changed</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>
    );

    const renderEventTab = () => (
      <div>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>⚠️ Adverse Event/Reaction</h3>
          <div>
            <label style={labelStyle}>Event Description *</label>
            <textarea name="eventDescription" value={formData.eventDescription} onChange={handleInputChange} style={{ ...inputStyle, height: '100px' }} placeholder="Detailed description of the adverse event..." required />
          </div>
          <div style={{ ...grid2Col, marginTop: '15px' }}>
            <div>
              <label style={labelStyle}>Onset Date *</label>
              <input type="date" name="onsetDate" value={formData.onsetDate} onChange={handleInputChange} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Stop Date</label>
              <input type="date" name="stopDate" value={formData.stopDate} onChange={handleInputChange} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '15px' }}>
            <label style={labelStyle}>Outcome</label>
            <select name="outcome" value={formData.outcome} onChange={handleInputChange} style={inputStyle}>
              <option value="">Select</option>
              <option value="recovered">Recovered/Resolved</option>
              <option value="recovering">Recovering/Resolving</option>
              <option value="not-recovered">Not Recovered/Not Resolved</option>
              <option value="recovered-sequelae">Recovered with Sequelae</option>
              <option value="fatal">Fatal</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>

        {formData.seriousness === 'serious' && (
          <div style={{ ...sectionStyle, borderLeftColor: '#dc3545' }}>
            <h3 style={{ ...sectionTitleStyle, color: '#dc3545' }}>🚨 Seriousness Criteria</h3>
            <p style={{ marginBottom: '10px', color: '#666' }}>Select all that apply:</p>
            <div style={checkboxGroupStyle}>
              {[
                { value: 'death', label: 'Results in Death' },
                { value: 'life-threatening', label: 'Life Threatening' },
                { value: 'hospitalization', label: 'Hospitalization or Prolongation' },
                { value: 'disability', label: 'Persistent Disability/Incapacity' },
                { value: 'congenital', label: 'Congenital Anomaly/Birth Defect' },
                { value: 'intervention', label: 'Medically Important Event' }
              ].map(criteria => (
                <label key={criteria.value} style={{ 
                  padding: '10px 15px', 
                  background: formData.seriousnessCriteria.includes(criteria.value) ? '#dc3545' : '#f8f9fa',
                  color: formData.seriousnessCriteria.includes(criteria.value) ? 'white' : '#333',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  border: '1px solid #ddd'
                }}>
                  <input
                    type="checkbox"
                    name="seriousnessCriteria"
                    value={criteria.value}
                    checked={formData.seriousnessCriteria.includes(criteria.value)}
                    onChange={handleInputChange}
                    style={{ marginRight: '8px' }}
                  />
                  {criteria.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );

    const renderReporterTab = () => (
      <div>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>📞 Reporter Information</h3>
          <div style={grid2Col}>
            <div>
              <label style={labelStyle}>Reporter Type *</label>
              <select name="reporterType" value={formData.reporterType} onChange={handleInputChange} style={inputStyle} required>
                <option value="">Select</option>
                <option value="physician">Physician</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="nurse">Nurse/Other Health Professional</option>
                <option value="consumer">Consumer/Patient</option>
                <option value="lawyer">Lawyer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reporter Name</label>
              <input type="text" name="reporterName" value={formData.reporterName} onChange={handleInputChange} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '15px' }}>
            <label style={labelStyle}>Address</label>
            <textarea name="reporterAddress" value={formData.reporterAddress} onChange={handleInputChange} style={{ ...inputStyle, height: '60px' }} />
          </div>
          <div style={{ ...grid3Col, marginTop: '15px' }}>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" name="reporterPhone" value={formData.reporterPhone} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" name="reporterEmail" value={formData.reporterEmail} onChange={handleInputChange} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Country *</label>
              <input type="text" name="reporterCountry" value={formData.reporterCountry} onChange={handleInputChange} style={inputStyle} required />
            </div>
          </div>
        </div>

        {formData.caseType === 'report-from-study' && (
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>🔬 Study Information</h3>
            <div style={grid3Col}>
              <div>
                <label style={labelStyle}>Study Number</label>
                <input type="text" name="studyNumber" value={formData.studyNumber} onChange={handleInputChange} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Study Type</label>
                <select name="studyType" value={formData.studyType} onChange={handleInputChange} style={inputStyle}>
                  <option value="">Select</option>
                  <option value="clinical-trial">Clinical Trial</option>
                  <option value="post-marketing">Post-Marketing Study</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Center ID</label>
                <input type="text" name="centerId" value={formData.centerId} onChange={handleInputChange} style={inputStyle} />
              </div>
            </div>
          </div>
        )}
      </div>
    );

    const renderNarrativeTab = () => (
      <div>
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>📝 Case Narrative</h3>
          <div>
            <label style={labelStyle}>Detailed Narrative *</label>
            <textarea 
              name="caseNarrative" 
              value={formData.caseNarrative} 
              onChange={handleInputChange} 
              style={{ ...inputStyle, height: '200px' }} 
              placeholder="Provide a comprehensive narrative of the case including:&#10;&#10;- Description of the adverse event&#10;- Temporal relationship to drug administration&#10;- Relevant medical history&#10;- Concomitant medications&#10;- Diagnostic tests and results&#10;- Treatment provided&#10;- Outcome and follow-up"
              required 
            />
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>💬 Company Remarks</h3>
          <div>
            <label style={labelStyle}>Internal Assessment/Comments</label>
            <textarea 
              name="companyRemarks" 
              value={formData.companyRemarks} 
              onChange={handleInputChange} 
              style={{ ...inputStyle, height: '100px' }} 
              placeholder="Internal assessment, causality evaluation, regulatory comments..."
            />
          </div>
        </div>
      </div>
    );

    return (
      <div style={dashboardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>Argus-Aligned Safety Case Entry</p>
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

        <div style={tabContainerStyle}>
          <button style={tabStyle(activeTab === 'general')} onClick={() => setActiveTab('general')}>General</button>
          <button style={tabStyle(activeTab === 'product')} onClick={() => setActiveTab('product')}>Product</button>
          <button style={tabStyle(activeTab === 'event')} onClick={() => setActiveTab('event')}>Adverse Event</button>
          <button style={tabStyle(activeTab === 'reporter')} onClick={() => setActiveTab('reporter')}>Reporter</button>
          <button style={tabStyle(activeTab === 'narrative')} onClick={() => setActiveTab('narrative')}>Narrative</button>
        </div>

        <form onSubmit={submitCase} style={formStyle}>
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'product' && renderProductTab()}
          {activeTab === 'event' && renderEventTab()}
          {activeTab === 'reporter' && renderReporterTab()}
          {activeTab === 'narrative' && renderNarrativeTab()}

          <div style={{ display: 'flex', gap: '15px', marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #dee2e6' }}>
            <button type="submit" style={{ ...buttonStyle, flex: 1, padding: '15px', fontSize: '16px' }}>
              💾 Submit Case to Safety Database
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

  // CASE LIST VIEW
  return (
    <div style={dashboardStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
          <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>VigiServe Foundation - Argus-Aligned Safety Database</p>
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
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Safety Cases ({cases.length})</h2>
        
        {cases.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
            No cases yet. Click "New Case" to create an Argus-aligned safety report.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Case #</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Receipt Date</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Product</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Event</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Seriousness</th>
                <th style={{ padding: '12px', borderBottom: '2px solid #dee2e6', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>{c.case_number}</td>
                  <td style={{ padding: '12px' }}>{c.receipt_date ? new Date(c.receipt_date).toLocaleDateString() : 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{c.product_name || 'N/A'}</td>
                  <td style={{ padding: '12px' }}>{c.event_description ? c.event_description.substring(0, 50) + '...' : 'N/A'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      background: c.seriousness === 'serious' ? '#dc3545' : '#28a745',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {c.seriousness?.toUpperCase() || 'NON-SERIOUS'}
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
const TRAINING_ACCOUNTS = [
  { username: 'triage1', password: 'train123', role: 'Triage', step: 1 },
  { username: 'dataentry1', password: 'train123', role: 'Data Entry', step: 2 },
  { username: 'medical1', password: 'train123', role: 'Medical Review', step: 3 },
  { username: 'quality1', password: 'train123', role: 'Quality Review', step: 4 },
];
  );
}

export default App;
