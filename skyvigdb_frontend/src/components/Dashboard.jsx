import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export const Dashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);

  useEffect(() => {
    fetch('/api/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(setStats);
    
    fetch('/api/cases', { credentials: 'include' })
      .then(r => r.json())
      .then(setCases);
  }, []);

  const getStepColor = (step) => {
    const colors = {
      triage: 'blue',
      dataentry: 'green',
      medical: 'purple',
      quality: 'orange',
      completed: 'gray'
    };
    return colors[step] || 'default';
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {user.fullName}</h1>
        <span className={`role-badge ${user.role}`}>{user.role}</span>
      </header>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Total Cases</h4>
            <span>{stats.totalCases}</span>
          </div>
          <div className="stat-card blue">
            <h4>In Triage</h4>
            <span>{stats.inTriage}</span>
          </div>
          <div className="stat-card green">
            <h4>Data Entry</h4>
            <span>{stats.inDataEntry}</span>
          </div>
          <div className="stat-card purple">
            <h4>Medical Review</h4>
            <span>{stats.inMedicalReview}</span>
          </div>
          <div className="stat-card orange">
            <h4>Quality Review</h4>
            <span>{stats.inQualityReview}</span>
          </div>
          <div className="stat-card gray">
            <h4>Completed</h4>
            <span>{stats.completed}</span>
          </div>
        </div>
      )}

      <div className="actions">
        {user.role === 'triage' && (
          <Link to="/case/new" className="btn-primary">Create New Case</Link>
        )}
      </div>

      <h2>Cases Requiring Attention</h2>
      <div className="case-list">
        {cases.map(c => (
          <div key={c.id} className={`case-card ${getStepColor(c.currentStep)}`}>
            <div className="case-header">
              <h4>{c.id}</h4>
              <span className={`step-badge ${c.currentStep}`}>{c.currentStep}</span>
            </div>
            <p><strong>Product:</strong> {c.triage.productName}</p>
            <p><strong>Event:</strong> {c.triage.eventDescription?.substring(0, 50)}...</p>
            <Link to={`/case/${c.id}`} className="btn-secondary">View Case</Link>
          </div>
        ))}
      </div>
    </div>
  );
};
