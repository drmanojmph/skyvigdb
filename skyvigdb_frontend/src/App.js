import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check for saved login on load
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
  };

  const fetchCases = async () => {
    try {
      const response = await axios.get(`${API_URL}/cases`);
      setCases(response.data);
    } catch (err) {
      console.error('Failed to fetch cases');
    }
  };

  const createCase = async () => {
    try {
      await axios.post(`${API_URL}/cases`);
      fetchCases();
    } catch (err) {
      console.error('Failed to create case');
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
        <h1>SkyVigDB Login</h1>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={login}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: '100%', padding: '10px', margin: '10px 0' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '10px', margin: '10px 0' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px' }}>
            Login
          </button>
        </form>
        {/* DEMO CREDENTIALS REMOVED FOR SECURITY */}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>SkyVigDB Dashboard</h1>
        <button 
          onClick={logout} 
          style={{ 
            padding: '10px 20px', 
            background: '#dc3545', 
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
      
      <p>Welcome, <strong>{user.username}</strong> ({user.role})</p>
      
      <button 
        onClick={createCase} 
        style={{ 
          padding: '10px 20px', 
          marginBottom: '20px',
          background: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        + New Case
      </button>
      
      <h2>Cases ({cases.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Case #</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {cases.map(c => (
            <tr key={c.id}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{c.case_number}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{c.current_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
