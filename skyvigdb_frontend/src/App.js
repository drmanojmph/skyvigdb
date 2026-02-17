import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null);
  const [cases, setCases] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const login = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username,
        password
      });
      setUser(response.data.user);
      setError('');
      fetchCases();
    } catch (err) {
      setError('Login failed');
    }
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
        <p>Demo: demo / demo123</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
      <h1>SkyVigDB Dashboard</h1>
      <p>Welcome, {user.username} ({user.role})</p>
      <button onClick={createCase} style={{ padding: '10px 20px', marginBottom: '20px' }}>
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
