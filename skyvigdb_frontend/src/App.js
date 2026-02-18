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
  const [loading, setLoading] = useState(false);
  
  const [triageData, setTriageData] = useState({
    receiptDate: '',
    reporterName: '',
    reporterContact: '',
    reporterCountry: '',
    productName: '',
    eventDescription: ''
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
      console.error('Failed to fetch cases:', err);
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

  // DEBUG VERSION - Shows alerts to track flow
  const submitTriage = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Validate all fields
    if (!triageData.receiptDate || !triageData.reporterName || !triageData.reporterContact || 
        !triageData.reporterCountry || !triageData.productName || !triageData.eventDescription) {
      setError('Please fill all required fields');
      setLoading(false);
      return;
    }
    
    try {
      const newCase = {
        ...triageData,
        status: 'Triage Complete',
        currentStep: 2,
        caseNumber: `PV-${Date.now()}`
      };
      
      console.log('Sending to API:', newCase);
      
      const response = await axios.post(`${API_URL}/cases`, newCase);
      
      console.log('API Response:', response.data);
      
      // Reset form
      setTriageData({
        receiptDate: '',
        reporterName: '',
        reporterContact: '',
        reporterCountry: '',
        productName: '',
        eventDescription: ''
      });
      
      setMessage('SUCCESS! Case created and sent to Data Entry');
      
      // Refresh cases list
      await fetchCases();
      
      // Change view back to queue
      setView('queue');
      
    } catch (err) {
      console.error('ERROR:', err);
      setError(`Failed: ${err.message}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  const getCasesForRole = () => {
    if (user?.role === 'Triage') return cases.filter(c => !c.currentStep || c.currentStep === 1);
    if (user?.role === 'Data Entry') return cases.filter(c => c.currentStep === 2);
    if (user?.role === 'Medical Review') return cases.filter(c => c.currentStep === 3);
    if (user?.role === 'Quality Review') return cases.filter(c => c.currentStep === 4);
    return [];
  };

  const styles = {
    loginContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #667eea 100%)' },
    card: { background: 'rgba(255,255,255,0.95)', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '500px' },
    accountGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' },
    accountBtn: (step) => ({ padding: '15px', border: 'none', borderRadius: '10px', cursor: 'pointer', background: step === 1 ? '#007bff' : step === 2 ? '#28a745' : step === 3 ? '#6f42c1' : '#fd7e14', color: 'white', fontWeight: 'bold' }),
    dashboard: { maxWidth: '1400px', margin: '0 auto', padding: '20px', background: '#f5f7fa', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '20px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
    button: { padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
    buttonDisabled: { padding: '10px 20px', background: '#cccccc', color: '#666666', border: 'none', borderRadius: '5px', cursor: 'not-allowed', fontWeight: 'bold' },
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
          <p style={{ textAlign: 'center', color: '#666', marginBottom: '10px' }}>Click to fill, then Sign In:</p>
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
                <button 
                  type="submit" 
                  disabled={loading}
                  style={loading ? { ...styles.buttonDisabled, flex: 1 } : { ...styles.button, flex: 1, background: '#007bff' }}
                >
                  {loading ? 'Creating...' : 'Create & Send to Data Entry →'}
                </button>
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

  // Simple placeholders for other roles
  return (
    <div style={styles.dashboard}>
      <div style={styles.header}>
        <div><h1 style={{ color: '#1e3c72', margin: 0 }}>SkyVigilance</h1><p>Step {user.step}: {user.role}</p></div>
        <button onClick={logout} style={{ ...styles.button, background: '#dc3545' }}>Logout</button>
      </div>
      <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
        <h2>This step is under construction</h2>
        <p>Role: {user.role}</p>
        <p>Cases in queue: {getCasesForRole().length}</p>
      </div>
    </div>
  );
}

export default App;
'''

print("Debug version created!")
print("Key changes:")
print("1. Added loading state to show when button is clicked")
print("2. Added form validation before submission")
print("3. Added console.log statements to track API calls")
print("4. Added error display with detailed messages")
print("5. Button shows 'Creating...' when loading")
print("6. Simplified other roles to focus on testing Triage first")
