import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export const DataEntryForm = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [formData, setFormData] = useState({
    patientAge: '',
    patientGender: '',
    patientDob: '',
    reporterType: '',
    reporterCountry: '',
    productIndication: '',
    onsetDate: '',
    seriousnessCriteria: []
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${caseId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setCaseData(data);
        // Pre-fill if data exists
        if (data.dataEntry) {
          setFormData({
            patientAge: data.dataEntry.patientAge || '',
            patientGender: data.dataEntry.patientGender || '',
            patientDob: data.dataEntry.patientDob || '',
            reporterType: data.dataEntry.reporterType || '',
            reporterCountry: data.dataEntry.reporterCountry || '',
            reporterCountry: data.dataEntry.reporterCountry || '',
            productIndication: data.dataEntry.productIndication || '',
            onsetDate: data.dataEntry.onsetDate || '',
            seriousnessCriteria: data.dataEntry.seriousnessCriteria || []
          });
        }
      });
  }, [caseId]);

  const seriousnessOptions = [
    'Death',
    'Life-threatening',
    'Hospitalization',
    'Disability',
    'Congenital anomaly',
    'Other serious'
  ];

  const handleSeriousnessChange = (criterion) => {
    setFormData(prev => ({
      ...prev,
      seriousnessCriteria: prev.seriousnessCriteria.includes(criterion)
        ? prev.seriousnessCriteria.filter(c => c !== criterion)
        : [...prev.seriousnessCriteria, criterion]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    const response = await fetch(`/api/cases/${caseId}/dataentry`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      credentials: 'include'
    });
    
    if (response.ok) {
      alert('Data entry completed! Case moved to Medical Review.');
      navigate('/dashboard');
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
    setSubmitting(false);
  };

  if (!caseData) return <div>Loading...</div>;

  return (
    <div className="form-container">
      <h2>Step 2: Data Entry</h2>
      
      <div className="case-summary">
        <h4>Case: {caseData.id}</h4>
        <p><strong>Reporter:</strong> {caseData.triage.reporterName}</p>
        <p><strong>Product:</strong> {caseData.triage.productName}</p>
        <p><strong>Event:</strong> {caseData.triage.eventDescription}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <h3>Patient Information</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label>Age</label>
            <input
              type="number"
              value={formData.patientAge}
              onChange={(e) => setFormData({...formData, patientAge: e.target.value})}
              placeholder="e.g., 45"
            />
          </div>

          <div className="form-group">
            
