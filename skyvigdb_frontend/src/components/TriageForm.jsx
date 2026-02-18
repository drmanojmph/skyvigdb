import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const TriageForm = () => {
  const [formData, setFormData] = useState({
    reporterName: '',
    patientInitials: '',
    productName: '',
    eventDescription: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    const response = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      credentials: 'include'
    });
    
    if (response.ok) {
      const newCase = await response.json();
      alert(`Case created: ${newCase.id}`);
      navigate('/dashboard');
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="form-container">
      <h2>Step 1: Triage - Create Case</h2>
      <p className="instruction">
        Enter the minimum 4 criteria to generate a Case ID. 
        This is the first step in pharmacovigilance case processing.
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Reporter Name *</label>
          <input
            type="text"
            value={formData.reporterName}
            onChange={(e) => setFormData({...formData, reporterName: e.target.value})}
            placeholder="e.g., Dr. John Smith"
            required
          />
        </div>

        <div className="form-group">
          <label>Patient Initials *</label>
          <input
            type="text"
            value={formData.patientInitials}
            onChange={(e) => setFormData({...formData, patientInitials: e.target.value})}
            placeholder="e.g., A.B."
            maxLength="10"
            required
          />
        </div>

        <div className="form-group">
          <label>Suspect Product Name *</label>
          <input
            type="text"
            value={formData.productName}
            onChange={(e) => setFormData({...formData, productName: e.target.value})}
            placeholder="e.g., Acetaminophen 500mg"
            required
          />
        </div>

        <div className="form-group">
          <label>Event Description *</label>
          <textarea
            value={formData.eventDescription}
            onChange={(e) => setFormData({...formData, eventDescription: e.target.value})}
            placeholder="Describe the adverse event..."
            rows="4"
            required
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Creating...' : 'Create Case & Proceed to Data Entry'}
        </button>
      </form>
    </div>
  );
};
