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
      const response = await axios.get(API_URL + '/cases');
      setCases(response.data);
    } catch (err) {
      console.log('Fetch error:', err);
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
    setLoading(true);
    setError('');
    
    try {
      const newCase = {
        ...triageData,
        status: 'Triage Complete',
        currentStep: 2,
        caseNumber: 'PV-' + Date.now()
      };
      
      console.log('Sending:', newCase);
      
      await axios.post(API_URL + '/cases', newCase);
      
      setTriageData({
        receiptDate: '',
        reporterName: '',
        reporterContact: '',
        reporterCountry: '',
        productName: '',
        eventDescription: ''
      });
      
      setMessage('Case created successfully!');
      fetchCases();
      setView('queue');
      
    } catch (err) {
      console.log('Error:', err);
      setError('Failed to create case. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const getCasesForRole = () => {
    if (user.role === 'Triage') return cases.filter(c => !c.currentStep || c.currentStep === 1);
    if (user.role === 'Data Entry') return cases.filter(c => c.currentStep === 2);
    if (user.role === 'Medical Review') return cases.filter(c => c.currentStep === 3);
    if (user.role === 'Quality Review') return cases.filter(c => c.currentStep === 4);
    return [];
  };

  // Styles
  const container = { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#1e3c72' };
  const card = { background: 'white', padding: '40px', borderRadius: '10px', width: '100%', maxWidth: '500px' };
  const btn = { padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' };
  const input = { width: '100%', padding: '10px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '5px' };
  const dashboard = { maxWidth: '1400px', margin: '0 auto', padding: '20px' };
  const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '20px', marginBottom: '20px' };
  const section = { background: 'white', padding: '20px', marginBottom: '20px', borderRadius: '5px' };

  if (!user) {
    return (
      <div style={container}>
        <h1 style={{ color: 'white' }}>SkyVigilance</h1>
        <div style={card}>
          <h2>Training Login</h2>
          <p>Click to fill credentials:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {TRAINING_ACCOUNTS.map(acc => (
              <button key={acc.username} type="button" style={btn} onClick={() => { setUsername(acc.username); setPassword(acc.password); }}>
                {acc.role}
              </button>
            ))}
          </div>
          {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
          <form onSubmit={login}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={input} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
            <button type="submit" style={{ ...btn, width: '100%' }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  if (user.role === 'Triage') {
    if (view === 'new') {
      return (
        <div style={dashboard}>
          <div style={header}>
            <h1>SkyVigilance - Triage</h1>
            <button onClick={logout} style={btn}>Logout</button>
          </div>
          
          <div style={section}>
            <h2>New Case</h2>
            {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
            
            <form onSubmit={submitTriage}>
              <label>Receipt Date:</label>
              <input type="datetime-local" name="receiptDate" value={triageData.receiptDate} onChange={handleTriageChange} style={input} required />
              
              <label>Reporter Name:</label>
              <input type="text" name="reporterName" value={triageData.reporterName} onChange={handleTriageChange} style={input} required />
              
              <label>Reporter Contact:</label>
              <input type="text" name="reporterContact" value={triageData.reporterContact} onChange={handleTriageChange} style={input} required />
              
              <label>Reporter Country:</label>
              <input type="text" name="reporterCountry" value={triageData.reporterCountry} onChange={handleTriageChange} style={input} required />
              
              <label>Product Name:</label>
              <input type="text" name="productName" value={triageData.productName} onChange={handleTriageChange} style={input} required />
              
              <label>Event Description:</label>
              <textarea name="eventDescription" value={triageData.eventDescription} onChange={handleTriageChange} style={{ ...input, height: '100px' }} required />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={loading} style={{ ...btn, flex: 1, background: loading ? '#ccc' : '#007bff' }}>
                  {loading ? 'Creating...' : 'Create Case'}
                </button>
                <button type="button" onClick={() => setView('queue')} style={btn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      );
    }
    
    return (
      <div style={dashboard}>
        <div style={header}>
          <h1>SkyVigilance - Triage</h1>
          <button onClick={logout} style={btn}>Logout</button>
        </div>
        
        <div style={section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>Queue ({getCasesForRole().length})</h2>
            <button onClick={() => setView('new')} style={btn}>+ New Case</button>
          </div>
          
          {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}
          
          {getCasesForRole().length === 0 ? (
            <p>No cases pending.</p>
          ) : (
            getCasesForRole().map(c => (
              <div key={c.id} style={{ padding: '15px', border: '1px solid #ddd', marginBottom: '10px', borderRadius: '5px' }}>
                <strong>{c.caseNumber}</strong> - {c.productName}
                <span style={{ float: 'right', padding: '5px 10px', background: '#ffc107', borderRadius: '5px' }}>{c.status || 'New'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={dashboard}>
      <div style={header}>
        <h1>SkyVigilance - {user.role}</h1>
        <button onClick={logout} style={btn}>Logout</button>
      </div>
      <div style={section}>
        <h2>Under Construction</h2>
        <p>This step is not yet implemented.</p>
        <p>Cases in queue: {getCasesForRole().length}</p>
      </div>
    </div>
  );
}

export default App;
