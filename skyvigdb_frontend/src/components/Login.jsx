import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TRAINING_ACCOUNTS = [
  { username: 'triage1', password: 'train123', role: 'Triage', color: 'blue' },
  { username: 'dataentry1', password: 'train123', role: 'Data Entry', color: 'green' },
  { username: 'medical1', password: 'train123', role: 'Medical Review', color: 'purple' },
  { username: 'quality1', password: 'train123', role: 'Quality Review', color: 'orange' },
];

export const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      onLogin(data.user);
      navigate('/dashboard');
    } else {
      setError('Invalid credentials');
    }
  };

  const quickLogin = (account) => {
    setCredentials({ username: account.username, password: account.password });
  };

  return (
    <div className="login-container">
      <h1>PV Case Processing Training</h1>
      
      <div className="training-accounts">
        <h3>Quick Login (Training Accounts)</h3>
        <div className="account-grid">
          {TRAINING_ACCOUNTS.map(acc => (
            <button
              key={acc.username}
              className={`account-btn ${acc.color}`}
              onClick={() => quickLogin(acc)}
            >
              <strong>{acc.role}</strong>
              <small>{acc.username}</small>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        <h3>Or Login Manually</h3>
        {error && <div className="error">{error}</div>}
        
        <input
          type="text"
          placeholder="Username"
          value={credentials.username}
          onChange={(e) => setCredentials({...credentials, username: e.target.value})}
        />
        
        <input
          type="password"
          placeholder="Password"
          value={credentials.password}
          onChange={(e) => setCredentials({...credentials, password: e.target.value})}
        />
        
        <button type="submit">Login</button>
      </form>
    </div>
  );
};
