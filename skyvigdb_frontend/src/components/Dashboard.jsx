import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const Dashboard = ({ user }) => {
  const [cases, setCases] = useState([]);
  const navigate = useNavigate();

  // Load cases when dashboard opens
  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    const response = await fetch('/api/cases');
    const data = await response.json();
    setCases(data);
  };

  // Filter cases based on user's role
  const getCasesForRole = () => {
    switch(user?.role) {
      case 'Triage':
        return cases.filter(c => c.status === 'New');
      case 'Data Entry':
        return cases.filter(c => c.status === 'Triage Complete');
      case 'Medical Review':
        return cases.filter(c => c.status === 'Data Entry Complete');
      case 'Quality Review':
        return cases.filter(c => c.status === 'Medical Review Complete');
      default:
        return [];
    }
  };

  const startCase = (caseId) => {
    // Navigate to case processing page
    navigate(`/case/${caseId}`);
  };

  return (
    <div className="dashboard">
      <header>
        <h1>PV Training - {user?.role} Dashboard</h1>
        <span>Welcome, {user?.username}</span>
      </header>

      <div className="queue-section">
        <h2>Cases Waiting for {user?.role}</h2>
        
        {getCasesForRole().length === 0 ? (
          <p>No cases available. Great job!</p>
        ) : (
          <table className="cases-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Patient</th>
                <th>Received Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {getCasesForRole().map(c => (
                <tr key={c.id}>
                  <td>{c.caseId}</td>
                  <td>{c.patientInitials || 'Pending'}</td>
                  <td>{c.receivedDate}</td>
                  <td>
                    <button onClick={() => startCase(c.id)}>
                      Start Processing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
