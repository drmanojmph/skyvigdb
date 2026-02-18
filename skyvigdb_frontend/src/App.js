import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TRAINING_ACCOUNTS = [
  { username: 'triage1', password: 'train123', role: 'Triage', step: 1 },
  { username: 'dataentry1', password: 'train123', role: 'Data Entry', step: 2 },
  { username: 'medical1', password: 'train123', role: 'Medical Review', step: 3 },
  { username: 'quality1', password: 'train123', role: 'Quality Review', step: 4 },
];

function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [view, setView] = useState('queue');
  const [selectedCase, setSelectedCase] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [triageData, setTriageData] = useState({
  receiptDate: '',      
  reporterName: '',
  reporterContact: '',
  reporterCountry: '',  
  productName: '',
  eventDescription: ''
  });

  const [formData, setFormData] = useState({
    caseNumber: '',
    receiptDate: '',
    seriousness: 'non-serious',
    caseType: 'spontaneous',
    patientInitials: '',
    patientAge: '',
    ageUnit: 'years',
    dateOfBirth: '',
    gender: '',
    weight: '',
    weightUnit: 'kg',
    height: '',
    heightUnit: 'cm',
    medicalHistory: '',
    concurrentConditions: '',
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
    eventDescription: '',
    onsetDate: '',
    stopDate: '',
    outcome: '',
    seriousnessCriteria: [],
    reporterType: '',
    reporterName: '',
    reporterAddress: '',
    reporterPhone: '',
    reporterEmail: '',
    reporterCountry: '',
    studyNumber: '',
    studyType: '',
    centerId: '',
    caseNarrative: '',
    companyRemarks: ''
  });

  const [medicalReview, setMedicalReview] = useState({
    causalityAssessment: '',
    listedness: '',
    severityAssessment: '',
    medicalComments: '',
    recommendedAction: ''
  });

  const [qualityReview, setQualityReview] = useState({
    dataQualityScore: '',
    completenessCheck: false,
    consistencyCheck: false,
    regulatoryCompliance: false,
    qualityComments: '',
    finalStatus: ''
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('skyvigdb_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      fetchCases();
    }
  }, []);

  const fetchCases = async () => {
    try {
      const response = await axios.get(`${API_URL}/cases`);
      setCases(response.data);
    } catch (err) {
      console.error('Failed to fetch cases');
    }
  };

  const login = async (e) => {
    e.preventDefault();
   
    const account = TRAINING_ACCOUNTS.find(
      acc => acc.username === username && acc.password === password
    );
   
    if (account) {
      const userData = {
        username: account.username,
        role: account.role,
        step: account.step
      };
      setUser(userData);
      localStorage.setItem('skyvigdb_user', JSON.stringify(userData));
      setError('');
      fetchCases();
      return;
    }
   
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
    setView('queue');
    setSelectedCase(null);
    localStorage.removeItem('skyvigdb_user');
    setUsername('');
    setPassword('');
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

  const handleTriageChange = (e) => {
    const { name, value } = e.target;
    setTriageData(prev => ({ ...prev, [name]: value }));
  };

  const handleMedicalReviewChange = (e) => {
    const { name, value } = e.target;
    setMedicalReview(prev => ({ ...prev, [name]: value }));
  };

  const handleQualityReviewChange = (e) => {
    const { name, value, type, checked } = e.target;
    setQualityReview(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const submitTriage = async (e) => {
    e.preventDefault();
    try {
      const newCase = {
        ...triageData,
        status: 'Triage Complete',
        currentStep: 2,
        caseNumber: `PV-${Date.now()}`,
        receiptDate: new Date().toISOString()
      };
      await axios.post(`${API_URL}/cases`, newCase);
      setTriageData({
        reporterName: '',
        reporterContact: '',
        productName: '',
        eventDescription: ''
      });
      fetchCases();
      alert('Case created and sent to Data Entry!');
    } catch (err) {
      console.error('Failed to create case');
    }
  };

  const submitDataEntry = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/cases/${selectedCase.id}`, {
        ...formData,
        status: 'Data Entry Complete',
        currentStep: 3
      });
      setView('queue');
      setSelectedCase(null);
      fetchCases();
      alert('Case completed and sent to Medical Review!');
    } catch (err) {
      console.error('Failed to update case');
    }
  };

  const submitMedicalReview = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/cases/${selectedCase.id}`, {
        ...medicalReview,
        status: 'Medical Review Complete',
        currentStep: 4
      });
      setView('queue');
      setSelectedCase(null);
      fetchCases();
      alert('Case reviewed and sent to Quality Review!');
    } catch (err) {
      console.error('Failed to submit medical review');
    }
  };

  const submitQualityReview = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/cases/${selectedCase.id}`, {
        ...qualityReview,
        status: qualityReview.finalStatus === 'approved' ? 'Approved' : 'Rejected',
        currentStep: qualityReview.finalStatus === 'approved' ? 5 : 3
      });
      setView('queue');
      setSelectedCase(null);
      fetchCases();
      alert(`Case ${qualityReview.finalStatus === 'approved' ? 'approved' : 'rejected'}!`);
    } catch (err) {
      console.error('Failed to submit quality review');
    }
  };

  const startProcessing = (caseItem) => {
    setSelectedCase(caseItem);
    if (user.role === 'Data Entry') {
      setFormData(prev => ({
        ...prev,
        productName: caseItem.productName || '',
        eventDescription: caseItem.eventDescription || '',
        reporterName: caseItem.reporterName || '',
        receiptDate: caseItem.receiptDate || ''
      }));
    }
    setView('process');
  };

  const getCasesForRole = () => {
    switch(user?.role) {
      case 'Triage':
        return cases.filter(c => !c.currentStep || c.currentStep === 1);
      case 'Data Entry':
        return cases.filter(c => c.currentStep === 2 || c.status === 'Triage Complete');
      case 'Medical Review':
        return cases.filter(c => c.currentStep === 3 || c.status === 'Data Entry Complete');
      case 'Quality Review':
        return cases.filter(c => c.currentStep === 4 || c.status === 'Medical Review Complete');
      default:
        return [];
    }
  };

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
    maxWidth: '500px',
  };

  const accountGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '20px'
  };

  const accountBtnStyle = (color) => ({
    padding: '15px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    background: color === 'blue' ? '#007bff' :
                color === 'green' ? '#28a745' :
                color === 'purple' ? '#6f42c1' : '#fd7e14',
    color: 'white',
    fontWeight: 'bold',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  });

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

  const stepBadgeStyle = (step) => ({
    padding: '5px 15px',
    borderRadius: '20px',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '14px',
    background: step === 1 ? '#007bff' :
                step === 2 ? '#28a745' :
                step === 3 ? '#6f42c1' : '#fd7e14'
  });

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

  const queueCardStyle = {
    background: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  if (!user) {
    return (
      <div style={loginContainerStyle}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '3rem', color: '#ffffff', margin: '0 0 10px 0' }}>SkyVigilance</h1>
          <p style={{ color: '#a8c0ff', margin: 0 }}>PV Case Processing Training</p>
          <p style={{ color: '#ffffff', opacity: 0.8, fontSize: '0.9rem', fontStyle: 'italic' }}>
            4-Step Workflow: Triage → Data Entry → Medical Review → Quality Review
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '20px' }}>
            Training Login
          </h2>
         
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#666' }}>Quick Login (Training Accounts)</h4>
            <div style={accountGridStyle}>
              {TRAINING_ACCOUNTS.map(acc => (
                <button
                  key={acc.username}
                  type="button"
                  style={accountBtnStyle(acc.color)}
                  onClick={() => { setUsername(acc.username); setPassword(acc.password); }}
                >
                  <span>Step {acc.step}</span>
                  <span style={{ fontSize: '12px', marginTop: '5px' }}>{acc.role}</span>
                </button>
              ))}
            </div>
          </div>

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

  if (user.role === 'Triage') {
    if (view === 'new') {
      return (
        <div style={dashboardStyle}>
          <div style={headerStyle}>
            <div>
              <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
              <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
                Step 1: Triage | Create Initial Case Record
              </p>
            </div>
            <div>
              <span style={{ marginRight: '20px', color: '#666' }}>
                Welcome, <strong>{user.username}</strong>
              </span>
              <span style={stepBadgeStyle(user.step)}>{user.role}</span>
              <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545', marginLeft: '10px' }}>
                Logout
              </button>
            </div>
          </div>

          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>New Case Triage (4 Minimum Criteria)</h2>
           
            <form onSubmit={submitTriage}>
              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>1. Reporter Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <label style={labelStyle}>Reporter Name *</label>
                    <input
                      type="text"
                      name="reporterName"
                      value={triageData.reporterName}
                      onChange={handleTriageChange}
                      style={inputStyle}
                      required
                      placeholder="Name of person reporting"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Information *</label>
                    <input
                      type="text"
                      name="reporterContact"
                      value={triageData.reporterContact}
                      onChange={handleTriageChange}
                      style={inputStyle}
                      required
                      placeholder="Phone or email"
                    />
                  </div>
                </div>
              </div>

              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>2. Product Information</h3>
                <div>
                  <label style={labelStyle}>Suspect Product Name *</label>
                  <input
                    type="text"
                    name="productName"
                    value={triageData.productName}
                    onChange={handleTriageChange}
                    style={inputStyle}
                    required
                    placeholder="Drug or product name"
                  />
                </div>
              </div>

              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>3. Adverse Event Description</h3>
                <div>
                  <label style={labelStyle}>Event Description *</label>
                  <textarea
                    name="eventDescription"
                    value={triageData.eventDescription}
                    onChange={handleTriageChange}
                    style={{ ...inputStyle, height: '100px' }}
                    required
                    placeholder="Brief description of what happened"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                <button type="submit" style={{ ...buttonStyle, flex: 1, padding: '15px', fontSize: '16px', background: '#007bff' }}>
                  Create Case & Send to Data Entry →
                </button>
                <button type="button" onClick={() => setView('queue')} style={{
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
        </div>
      );
    }

    return (
      <div style={dashboardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
              Step 1: Triage | Initial Case Assessment
            </p>
          </div>
          <div>
            <span style={{ marginRight: '20px', color: '#666' }}>
              Welcome, <strong>{user.username}</strong>
            </span>
            <span style={stepBadgeStyle(user.step)}>{user.role}</span>
            <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545', marginLeft: '10px' }}>
              Logout
            </button>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#333', margin: 0 }}>New Reports Queue</h2>
            <button onClick={() => setView('new')} style={{ ...buttonStyle, background: '#007bff' }}>
              + New Case Triage
            </button>
          </div>
         
          {getCasesForRole().length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              No new reports pending triage. Click "New Case Triage" to create a case.
            </p>
          ) : (
            getCasesForRole().map(c => (
              <div key={c.id} style={queueCardStyle}>
                <div>
                  <strong>Case: {c.caseNumber || 'Pending'}</strong>
                  <p style={{ margin: '5px 0', color: '#666' }}>Product: {c.productName}</p>
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>
                    Received: {c.receiptDate ? new Date(c.receiptDate).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <span style={{
                  padding: '5px 10px',
                  borderRadius: '5px',
                  background: '#ffc107',
                  color: '#000',
                  fontSize: '12px'
                }}>
                  {c.status || 'New'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (user.role === 'Data Entry') {
    if (view === 'process' && selectedCase) {
      return (
        <div style={dashboardStyle}>
          <div style={headerStyle}>
            <div>
              <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
              <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
                Step 2: Data Entry | Complete Case Information
              </p>
            </div>
            <div>
              <span style={{ marginRight: '20px', color: '#666' }}>
                Case: <strong>{selectedCase.caseNumber}</strong>
              </span>
              <span style={stepBadgeStyle(user.step)}>{user.role}</span>
              <button onClick={() => {setView('queue'); setSelectedCase(null);}} style={{ ...buttonStyle, background: '#6c757d', marginLeft: '10px' }}>
                ← Back to Queue
              </button>
            </div>
          </div>

          <form onSubmit={submitDataEntry} style={{ background: 'white', padding: '30px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Patient Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                <div>
                  <label style={labelStyle}>Patient Initials *</label>
                  <input type="text" name="patientInitials" value={formData.patientInitials} onChange={handleInputChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} style={inputStyle} />
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
                <div>
                  <label style={labelStyle}>Age</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="number" name="patientAge" value={formData.patientAge} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} />
                    <select name="ageUnit" value={formData.ageUnit} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }}>
                      <option value="years">Years</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Product Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={labelStyle}>Product Name *</label>
                  <input type="text" name="productName" value={formData.productName} onChange={handleInputChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Generic Name</label>
                  <input type="text" name="genericName" value={formData.genericName} onChange={handleInputChange} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={labelStyle}>Dose *</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input type="text" name="dose" value={formData.dose} onChange={handleInputChange} style={{ ...inputStyle, flex: 2 }} required />
                    <select name="doseUnit" value={formData.doseUnit} onChange={handleInputChange} style={{ ...inputStyle, flex: 1 }}>
                      <option value="mg">mg</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Route *</label>
                  <select name="route" value={formData.route} onChange={handleInputChange} style={inputStyle} required>
                    <option value="">Select</option>
                    <option value="oral">Oral</option>
                    <option value="iv">IV</option>
                    <option value="im">IM</option>
                    <option value="sc">SC</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Indication</label>
                  <input type="text" name="indication" value={formData.indication} onChange={handleInputChange} style={inputStyle} placeholder="Reason for use" />
                </div>
              </div>
            </div>

            <div style={sectionStyle}>
              <h3 style={sectionTitleStyle}>Adverse Event</h3>
              <div>
                <label style={labelStyle}>Event Description *</label>
                <textarea name="eventDescription" value={formData.eventDescription} onChange={handleInputChange} style={{ ...inputStyle, height: '100px' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div>
                  <label style={labelStyle}>Onset Date *</label>
                  <input type="date" name="onsetDate" value={formData.onsetDate} onChange={handleInputChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>Outcome</label>
                  <select name="outcome" value={formData.outcome} onChange={handleInputChange} style={inputStyle}>
                    <option value="">Select</option>
                    <option value="recovered">Recovered</option>
                    <option value="recovering">Recovering</option>
                    <option value="not-recovered">Not Recovered</option>
                    <option value="fatal">Fatal</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button type="submit" style={{ ...buttonStyle, flex: 1, padding: '15px', fontSize: '16px', background: '#28a745' }}>
                Complete & Send to Medical Review →
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div style={dashboardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
              Step 2: Data Entry | Complete Case Details
            </p>
          </div>
          <div>
            <span style={{ marginRight: '20px', color: '#666' }}>
              Welcome, <strong>{user.username}</strong>
            </span>
            <span style={stepBadgeStyle(user.step)}>{user.role}</span>
            <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545', marginLeft: '10px' }}>
              Logout
            </button>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>Cases Pending Data Entry ({getCasesForRole().length})</h2>
         
          {getCasesForRole().length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              No cases pending. Waiting for Triage to create new cases.
            </p>
          ) : (
            getCasesForRole().map(c => (
              <div key={c.id} style={queueCardStyle}>
                <div>
                  <strong>Case: {c.caseNumber}</strong>
                  <p style={{ margin: '5px 0', color: '#666' }}>Product: {c.productName}</p>
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>From Triage: {c.reporterName}</p>
                </div>
                <button onClick={() => startProcessing(c)} style={{ ...buttonStyle, background: '#28a745' }}>
                  Start Data Entry
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (user.role === 'Medical Review') {
    if (view === 'process' && selectedCase) {
      return (
        <div style={dashboardStyle}>
          <div style={headerStyle}>
            <div>
              <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
              <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
                Step 3: Medical Review | Clinical Assessment
              </p>
            </div>
            <div>
              <span style={{ marginRight: '20px', color: '#666' }}>
                Case: <strong>{selectedCase.caseNumber}</strong>
              </span>
              <span style={stepBadgeStyle(user.step)}>{user.role}</span>
              <button onClick={() => {setView('queue'); setSelectedCase(null);}} style={{ ...buttonStyle, background: '#6c757d', marginLeft: '10px' }}>
                ← Back to Queue
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>Case Summary</h3>
              <p><strong>Product:</strong> {selectedCase.productName}</p>
              <p><strong>Event:</strong> {selectedCase.eventDescription}</p>
              <p><strong>Patient:</strong> {selectedCase.patientInitials || 'N/A'}</p>
              <p><strong>Reporter:</strong> {selectedCase.reporterName}</p>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>Medical Assessment</h3>
              <form onSubmit={submitMedicalReview}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={labelStyle}>Causality Assessment *</label>
                  <select name="causalityAssessment" value={medicalReview.causalityAssessment} onChange={handleMedicalReviewChange} style={inputStyle} required>
                    <option value="">Select</option>
                    <option value="certain">Certain</option>
                    <option value="probable">Probable/Likely</option>
                    <option value="possible">Possible</option>
                    <option value="unlikely">Unlikely</option>
                    <option value="unassessable">Unassessable</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={labelStyle}>Listedness *</label>
                  <select name="listedness" value={medicalReview.listedness} onChange={handleMedicalReviewChange} style={inputStyle} required>
                    <option value="">Select</option>
                    <option value="listed">Listed (Expected)</option>
                    <option value="unlisted">Unlisted (Unexpected)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={labelStyle}>Medical Comments</label>
                  <textarea name="medicalComments" value={medicalReview.medicalComments} onChange={handleMedicalReviewChange} style={{ ...inputStyle, height: '100px' }} placeholder="Clinical assessment..." />
                </div>

                <button type="submit" style={{ ...buttonStyle, width: '100%', padding: '15px', background: '#6f42c1' }}>
                  Complete Medical Review & Send to Quality →
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={dashboardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
              Step 3: Medical Review | Clinical Assessment
            </p>
          </div>
          <div>
            <span style={{ marginRight: '20px', color: '#666' }}>
              Welcome, <strong>{user.username}</strong>
            </span>
            <span style={stepBadgeStyle(user.step)}>{user.role}</span>
            <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545', marginLeft: '10px' }}>
              Logout
            </button>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>Cases Pending Medical Review ({getCasesForRole().length})</h2>
         
          {getCasesForRole().length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              No cases pending medical review.
            </p>
          ) : (
            getCasesForRole().map(c => (
              <div key={c.id} style={queueCardStyle}>
                <div>
                  <strong>Case: {c.caseNumber}</strong>
                  <p style={{ margin: '5px 0', color: '#666' }}>Product: {c.productName}</p>
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>Event: {c.eventDescription?.substring(0, 50)}...</p>
                </div>
                <button onClick={() => startProcessing(c)} style={{ ...buttonStyle, background: '#6f42c1' }}>
                  Start Medical Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (user.role === 'Quality Review') {
    if (view === 'process' && selectedCase) {
      return (
        <div style={dashboardStyle}>
          <div style={headerStyle}>
            <div>
              <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
              <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
                Step 4: Quality Review | Final Verification
              </p>
            </div>
            <div>
              <span style={{ marginRight: '20px', color: '#666' }}>
                Case: <strong>{selectedCase.caseNumber}</strong>
              </span>
              <span style={stepBadgeStyle(user.step)}>{user.role}</span>
              <button onClick={() => {setView('queue'); setSelectedCase(null);}} style={{ ...buttonStyle, background: '#6c757d', marginLeft: '10px' }}>
                ← Back to Queue
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>Case Details Review</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div>
                  <p><strong>Product:</strong> {selectedCase.productName}</p>
                  <p><strong>Event:</strong> {selectedCase.eventDescription}</p>
                  <p><strong>Patient:</strong> {selectedCase.patientInitials}</p>
                </div>
                <div>
                  <p><strong>Causality:</strong> {selectedCase.causalityAssessment || 'Pending'}</p>
                  <p><strong>Listedness:</strong> {selectedCase.listedness || 'Pending'}</p>
                </div>
              </div>
             
              <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Medical Review Comments</h4>
              <p style={{ background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                {selectedCase.medicalComments || 'No comments'}
              </p>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>Quality Checklist</h3>
              <form onSubmit={submitQualityReview}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="completenessCheck"
                      checked={qualityReview.completenessCheck}
                      onChange={handleQualityReviewChange}
                      style={{ marginRight: '10px' }}
                    />
                    All required fields complete
                  </label>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="consistencyCheck"
                      checked={qualityReview.consistencyCheck}
                      onChange={handleQualityReviewChange}
                      style={{ marginRight: '10px' }}
                    />
                    Data consistency verified
                  </label>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="regulatoryCompliance"
                      checked={qualityReview.regulatoryCompliance}
                      onChange={handleQualityReviewChange}
                      style={{ marginRight: '10px' }}
                    />
                    Regulatory compliance met
                  </label>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={labelStyle}>Quality Comments</label>
                  <textarea
                    name="qualityComments"
                    value={qualityReview.qualityComments}
                    onChange={handleQualityReviewChange}
                    style={{ ...inputStyle, height: '80px' }}
                    placeholder="Any quality issues or observations"
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={labelStyle}>Final Decision *</label>
                  <select
                    name="finalStatus"
                    value={qualityReview.finalStatus}
                    onChange={handleQualityReviewChange}
                    style={inputStyle}
                    required
                  >
                    <option value="">Select</option>
                    <option value="approved">✓ Approve Case</option>
                    <option value="rejected">✗ Reject - Send Back</option>
                  </select>
                </div>

                <button type="submit" style={{ ...buttonStyle, width: '100%', padding: '15px', background: '#fd7e14' }}>
                  Finalize Quality Review
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={dashboardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '14px' }}>
              Step 4: Quality Review | Final Verification
            </p>
          </div>
          <div>
            <span style={{ marginRight: '20px', color: '#666' }}>
              Welcome, <strong>{user.username}</strong>
            </span>
            <span style={stepBadgeStyle(user.step)}>{user.role}</span>
            <button onClick={logout} style={{ ...buttonStyle, background: '#dc3545', marginLeft: '10px' }}>
              Logout
            </button>
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#333', marginBottom: '20px' }}>Cases Pending Quality Review ({getCasesForRole().length})</h2>
         
          {getCasesForRole().length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              No cases pending quality review. All caught up!
            </p>
          ) : (
            getCasesForRole().map(c => (
              <div key={c.id} style={queueCardStyle}>
                <div>
                  <strong>Case: {c.caseNumber}</strong>
                  <p style={{ margin: '5px 0', color: '#666' }}>Product: {c.productName}</p>
                  <p style={{ margin: 0, color: '#999', fontSize: '12px' }}>
                    Medical Review: {c.causalityAssessment ? 'Completed' : 'Pending'}
                  </p>
                </div>
                <button onClick={() => startProcessing(c)} style={{ ...buttonStyle, background: '#fd7e14' }}>
                  Start Quality Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={dashboardStyle}>
      <div style={headerStyle}>
        <h1>Unknown Role: {user?.role}</h1>
        <button onClick={logout} style={buttonStyle}>Logout</button>
      </div>
    </div>
  );
}

export default App;
