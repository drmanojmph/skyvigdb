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
  const [message, setMessage] = useState('');
  
  const [triageData, setTriageData] = useState({
    receiptDate: '',
    reporterName: '',
    reporterContact: '',
    reporterCountry: '',
    productName: '',
    eventDescription: ''
  });

  const [formData, setFormData] = useState({
    patientInitials: '',
    gender: '',
    patientAge: '',
    ageUnit: 'years',
    productName: '',
    dose: '',
    doseUnit: 'mg',
    route: '',
    indication: '',
    eventDescription: '',
    onsetDate: '',
    outcome: ''
  });

  const [medicalReview, setMedicalReview] = useState({
    causalityAssessment: '',
    listedness: '',
    medicalComments: ''
  });

  const [qualityReview, setQualityReview] = useState({
    completenessCheck: false,
    consistencyCheck: false,
    regulatoryCompliance: false,
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
    const account = TRAINING_ACCOUNTS.find(acc => acc.username === username && acc.password === password);
    if (account) {
      const userData = { username: account.username, role: account.role, step: account.step };
      setUser(userData);
      localStorage.setItem('skyvigdb_user', JSON.stringify(userData));
      fetchCases();
    } else {
      setError('Invalid credentials');
    }
  };

  const logout = () => {
    setUser(null);
    setCases([]);
    localStorage.removeItem('skyvigdb_user');
  };

  const handleTriageChange = (e) => {
    const { name, value } = e.target;
    setTriageData(prev => ({ ...prev, [name]: value }));
  };

  const submitTriage = async (e) => {
    e.preventDefault();
    try {
      const newCase = {
        ...triageData,
        status: 'Triage Complete',
        currentStep: 2,
        caseNumber: `PV-${Date.now()}`
      };
      await axios.post(`${API_URL}/cases`, newCase);
      setTriageData({ receiptDate: '', reporterName: '', reporterContact: '', reporterCountry: '', productName: '', eventDescription: '' });
      setMessage('Case created and sent to Data Entry!');
      fetchCases();
      setTimeout(() => { setView('queue'); setMessage(''); }, 2000);
    } catch (err) {
      setError('Failed to create case');
    }
  };

  const getCasesForRole = () => {
    if (user?.role === 'Triage') return cases.filter(c => !c.currentStep || c.currentStep === 1);
    if (user?.role === 'Data Entry') return cases.filter(c => c.currentStep === 2);
    if (user?.role === 'Medical Review') return cases.filter(c => c.currentStep === 3);
    if (user?.role === 'Quality Review') return cases.filter(c => c.currentStep === 4);
    return [];
  };

  const startProcessing = (caseItem) => {
    setSelectedCase(caseItem);
    if (user.role === 'Data Entry') {
      setFormData(prev => ({ ...prev, productName: caseItem.productName || '', eventDescription: caseItem.eventDescription || '' }));
    }
    setView('process');
  };

  const submitDataEntry = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/cases/${selectedCase.id}`, { ...formData, status: 'Data Entry Complete', currentStep: 3 });
      setMessage('Sent to Medical Review!');
      fetchCases();
      setTimeout(() => { setView('queue'); setSelectedCase(null); setMessage(''); }, 2000);
    } catch (err) {
      setError('Failed to submit');
    }
  };

  const submitMedicalReview = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/cases/${selectedCase.id}`, { ...medicalReview, status: 'Medical Review Complete', currentStep: 4 });
      setMessage('Sent to Quality Review!');
      fetchCases();
      setTimeout(() => { setView('queue'); setSelectedCase(null); setMessage(''); }, 2000);
    } catch (err) {
      setError('Failed to submit');
    }
  };

  const submitQualityReview = async (e) => {
    e.preventDefault();
    try {
      const status = qualityReview.finalStatus === 'approved' ? 'Approved' : 'Rejected';
      const step = qualityReview.finalStatus === 'approved' ? 5 : 3;
      await axios.put(`${API_URL}/cases/${selectedCase.id}`, { ...qualityReview, status, currentStep: step });
      setMessage(`Case ${status}!`);
      fetchCases();
      setTimeout(() => { setView('queue'); setSelectedCase(null); setMessage(''); }, 2000);
    } catch (err) {
      setError('Failed to submit');
    }
  };

  const styles = {
    loginContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #667eea 100%)' },
    card: { background: 'rgba(255,255,255,0.95)', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '500px' },
    accountGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' },
    accountBtn: (step) => ({ padding: '15px', border: 'none', borderRadius: '10px', cursor: 'pointer', background: step === 1 ? '#007bff' : step === 2 ? '#28a745' : step === 3 ? '#6f42c1' : '#fd7e14', color: 'white', fontWeight: 'bold' }),
    dashboard: { maxWidth: '1400px', margin: '0 auto', padding: '20px', background: '#f5f7fa', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    button: { padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    input: { width: '100%', padding: '10px', margin: '5px 0 15px 0', border: '1px solid #ddd', borderRadius: '5px', fontSize: '14px' },
    label: { fontWeight: 'bold', color: '#333', display: 'block', marginBottom: '5px', fontSize: '13px' },
    section: { marginBottom: '25px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #667eea' },
    queueCard: { background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    alert: (type) => ({ padding: '15px', borderRadius: '5px', marginBottom: '20px', background: type === 'error' ? '#f8d7da' : '#d4edda', color: type === 'error' ? '#721c24' : '#155724' })
  };

  if (!user) {
    return (
      <div style={styles.loginContainer}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '3rem', color: '#ffffff', margin: '0 0 10px 0' }}>SkyVigilance</h1>
          <p style={{ color: '#a8c0ff', margin: 0 }}>PV Case Processing Training</p>
        </div>
        <div style={styles.card}>
          <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '20px' }}>Training Login</h2>
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '10px' }}>Click to fill credentials, then Sign In:</p>
          <div style={styles.accountGrid}>
            {TRAINING_ACCOUNTS.map(acc => (
              <button key={acc.username} type="button" style={styles.accountBtn(acc.step)} onClick={() => { setUsername(acc.username); setPassword(acc.password); }}>
                {acc.role}
              </button>
            ))}
          </div>
          {error && <div style={styles.alert('error')}>{error}</div>}
          <form onSubmit={login}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.input} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
            <button type="submit" style={{ ...styles.button, width: '100%', padding: '15px' }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  if (user.role === 'Triage') {
    if (view === 'new') {
      return (
        <div style={styles.dashboard}>
          <div style={styles.header}>
            <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 1: Triage</p></div>
            <div><span style={{ marginRight: '20px' }}>Welcome, <strong>{user.username}</strong></span><button onClick={logout} style={{ ...styles.button, background: '#dc3545' }}>Logout</button></div>
          </div>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px' }}>
            <h2>New Case Triage</h2>
            {message && <div style={styles.alert('success')}>{message}</div>}
            {error && <div style={styles.alert('error')}>{error}</div>}
            <form onSubmit={submitTriage}>
              <div style={styles.section}>
                <h3>Initial Receipt (Day Zero)</h3>
                <label style={styles.label}>Receipt Date *</label>
                <input type="datetime-local" name="receiptDate" value={triageData.receiptDate} onChange={handleTriageChange} style={styles.input} required />
              </div>
              <div style={styles.section}>
                <h3>Reporter Information</h3>
                <label style={styles.label}>Name *</label>
                <input type="text" name="reporterName" value={triageData.reporterName} onChange={handleTriageChange} style={styles.input} required />
                <label style={styles.label}>Contact *</label>
                <input type="text" name="reporterContact" value={triageData.reporterContact} onChange={handleTriageChange} style={styles.input} required />
                <label style={styles.label}>Country *</label>
                <input type="text" name="reporterCountry" value={triageData.reporterCountry} onChange={handleTriageChange} style={styles.input} required />
              </div>
              <div style={styles.section}>
                <h3>Product & Event</h3>
                <label style={styles.label}>Product Name *</label>
                <input type="text" name="productName" value={triageData.productName} onChange={handleTriageChange} style={styles.input} required />
                <label style={styles.label}>Event Description *</label>
                <textarea name="eventDescription" value={triageData.eventDescription} onChange={handleTriageChange} style={{ ...styles.input, height: '100px' }} required />
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button type="submit" style={{ ...styles.button, flex: 1, background: '#007bff' }}>Create & Send to Data Entry →</button>
                <button type="button" onClick={() => setView('queue')} style={{ ...styles.button, background: '#6c757d' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 1: Triage</p></div>
          <div><span style={{ marginRight: '20px' }}>Welcome, <strong>{user.username}</strong></span><button onClick={logout} style={{ ...styles.button, background: '#dc3545' }}>Logout</button></div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>New Reports Queue</h2>
            <button onClick={() => setView('new')} style={{ ...styles.button, background: '#007bff' }}>+ New Case</button>
          </div>
          {message && <div style={styles.alert('success')}>{message}</div>}
          {getCasesForRole().length === 0 ? <p>No cases pending.</p> : getCasesForRole().map(c => (
            <div key={c.id} style={styles.queueCard}>
              <div><strong>{c.caseNumber}</strong><p>{c.productName}</p></div>
              <span style={{ padding: '5px 10px', background: '#ffc107', borderRadius: '5px' }}>{c.status || 'New'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (user.role === 'Data Entry' && view === 'process' && selectedCase) {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 2: Data Entry</p></div>
          <div><span style={{ marginRight: '20px' }}>Case: <strong>{selectedCase.caseNumber}</strong></span><button onClick={() => {setView('queue'); setSelectedCase(null);}} style={styles.button}>← Back</button></div>
        </div>
        {message && <div style={styles.alert('success')}>{message}</div>}
        <form onSubmit={submitDataEntry} style={{ background: 'white', padding: '30px', borderRadius: '10px' }}>
          <div style={styles.section}>
            <h3>Patient</h3>
            <input type="text" name="patientInitials" placeholder="Initials" value={formData.patientInitials} onChange={(e) => setFormData({...formData, patientInitials: e.target.value})} style={styles.input} />
            <select name="gender" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} style={styles.input}>
              <option value="">Gender</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          <div style={styles.section}>
            <h3>Product</h3>
            <input type="text" name="productName" value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value})} style={styles.input} />
            <input type="text" name="dose" placeholder="Dose" value={formData.dose} onChange={(e) => setFormData({...formData, dose: e.target.value})} style={styles.input} />
          </div>
          <button type="submit" style={{ ...styles.button, background: '#28a745' }}>Complete & Send to Medical →</button>
        </form>
      </div>
    );
  }

  if (user.role === 'Data Entry') {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 2: Data Entry</p></div>
          <div><span style={{ marginRight: '20px' }}>Welcome, <strong>{user.username}</strong></span><button onClick={logout} style={{ ...styles.button, background: '#dc3545' }}>Logout</button></div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
          <h2>Cases Pending ({getCasesForRole().length})</h2>
          {getCasesForRole().map(c => (
            <div key={c.id} style={styles.queueCard}>
              <div><strong>{c.caseNumber}</strong><p>{c.productName}</p></div>
              <button onClick={() => startProcessing(c)} style={{ ...styles.button, background: '#28a745' }}>Start</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (user.role === 'Medical Review' && view === 'process' && selectedCase) {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 3: Medical Review</p></div>
          <div><button onClick={() => {setView('queue'); setSelectedCase(null);}} style={styles.button}>← Back</button></div>
        </div>
        {message && <div style={styles.alert('success')}>{message}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
            <h3>Case: {selectedCase.caseNumber}</h3>
            <p><strong>Product:</strong> {selectedCase.productName}</p>
            <p><strong>Event:</strong> {selectedCase.eventDescription}</p>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
            <form onSubmit={submitMedicalReview}>
              <label style={styles.label}>Causality *</label>
              <select name="causalityAssessment" value={medicalReview.causalityAssessment} onChange={(e) => setMedicalReview({...medicalReview, causalityAssessment: e.target.value})} style={styles.input} required>
                <option value="">Select</option><option value="certain">Certain</option><option value="probable">Probable</option><option value="possible">Possible</option>
              </select>
              <label style={styles.label}>Listedness *</label>
              <select name="listedness" value={medicalReview.listedness} onChange={(e) => setMedicalReview({...medicalReview, listedness: e.target.value})} style={styles.input} required>
                <option value="">Select</option><option value="listed">Listed</option><option value="unlisted">Unlisted</option>
              </select>
              <button type="submit" style={{ ...styles.button, background: '#6f42c1' }}>Send to Quality →</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (user.role === 'Medical Review') {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 3: Medical Review</p></div>
          <button onClick={logout} style={{ ...styles.button, background: '#dc3545' }}>Logout</button>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
          <h2>Pending ({getCasesForRole().length})</h2>
          {getCasesForRole().map(c => (
            <div key={c.id} style={styles.queueCard}>
              <div><strong>{c.caseNumber}</strong><p>{c.productName}</p></div>
              <button onClick={() => startProcessing(c)} style={{ ...styles.button, background: '#6f42c1' }}>Review</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (user.role === 'Quality Review' && view === 'process' && selectedCase) {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 4: Quality Review</p></div>
          <div><button onClick={() => {setView('queue'); setSelectedCase(null);}} style={styles.button}>← Back</button></div>
        </div>
        {message && <div style={styles.alert('success')}>{message}</div>}
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
          <h3>{selectedCase.caseNumber}</h3>
          <form onSubmit={submitQualityReview}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <input type="checkbox" checked={qualityReview.completenessCheck} onChange={(e) => setQualityReview({...qualityReview, completenessCheck: e.target.checked})} style={{ marginRight: '10px' }} />
              Complete
            </label>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <input type="checkbox" checked={qualityReview.consistencyCheck} onChange={(e) => setQualityReview({...qualityReview, consistencyCheck: e.target.checked})} style={{ marginRight: '10px' }} />
              Consistent
            </label>
            <label style={styles.label}>Decision *</label>
            <select value={qualityReview.finalStatus} onChange={(e) => setQualityReview({...qualityReview, finalStatus: e.target.value})} style={styles.input} required>
              <option value="">Select</option><option value="approved">Approve</option><option value="rejected">Reject</option>
            </select>
            <button type="submit" style={{ ...styles.button, background: '#fd7e14' }}>Finalize</button>
          </form>
        </div>
      </div>
    );
  }

  if (user.role === 'Quality Review') {
    return (
      <div style={styles.dashboard}>
        <div style={styles.header}>
          <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p style={{ color: '#666', margin: '5px 0 0 0' }}>Step 4: Quality Review</p></div>
          <button onClick={logout} style={{ ...styles.button, background: '#dc3545' }}>Logout</button>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
          <h2>Pending ({getCasesForRole().length})</h2>
          {getCasesForRole().map(c => (
            <div key={c.id} style={styles.queueCard}>
              <div><strong>{c.caseNumber}</strong><p>{c.productName}</p></div>
              <button onClick={() => startProcessing(c)} style={{ ...styles.button, background: '#fd7e14' }}>Review</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div style={styles.dashboard}><button onClick={logout} style={styles.button}>Logout</button></div>;
}

export default App;
