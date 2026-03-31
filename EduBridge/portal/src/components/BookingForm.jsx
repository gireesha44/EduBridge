import React, { useState } from 'react';
import { usePortal } from '../context/PortalContext';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { generateSessionPlan } from '../services/aiService';

const BookingForm = ({ student, onComplete }) => {
  const { bookSession, availability, mentor } = usePortal();
  const [formData, setFormData] = useState({
    subject: student.weak_subjects?.[0] || mentor.subjects?.[0] || '',
    topic: '',
    activities: '',
    date: '',
    time: '',
    place: ''
  });

  const [loadingAi, setLoadingAi] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const handleAiFill = async () => {
     setLoadingAi(true);
     try {
        const plan = await generateSessionPlan(student);
        if (plan) {
            setFormData(prev => ({
               ...prev,
               topic: plan.topic,
               activities: plan.activities.join('\n')
            }));
        }
     } catch (e) {
        console.error(e);
     }
     setLoadingAi(false);
  };

  // Available dates based on mentor's set availability map
  const availableDates = Object.keys(availability).filter(d => availability[d].length > 0);
  
  // Available times based on the chosen date
  const availableTimes = formData.date ? availability[formData.date] || [] : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      bookSession({
        student_id: student.id,
        subject: formData.subject,
        topic: formData.topic,
        activities: formData.activities,
        date: formData.date,
        time: formData.time,
        place: formData.place
      });
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        if(onComplete) onComplete();
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (successMsg) {
    return (
      <div className="flex-center animate-fade-in" style={{ flexDirection: 'column', gap: '1rem', padding: '2rem 1rem', background: '#ecfdf5', borderRadius: '8px' }}>
        <CheckCircle size={48} color="var(--secondary)" />
        <h3 style={{ color: 'var(--secondary)' }}>Session Booked Successfully!</h3>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in" style={{ background: '#F9FAFB', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
      {errorMsg && (
        <div style={{ background: '#FEF2F2', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      )}

      <div className="flex-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
         <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Session Details</h4>
         <button type="button" onClick={handleAiFill} disabled={loadingAi} className="btn btn-sm" style={{ background: '#FDF4FF', color: '#C026D3', border: '1px solid #F5D0FE', boxShadow: '0 1px 2px rgba(192,38,211,0.1)' }}>
            {loadingAi ? 'Generating...' : '🪄 Auto-Fill Details via AI'}
         </button>
      </div>

      <div className="form-group">
        <label className="form-label">Focus Subject</label>
        <select className="form-select" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required>
           <option value="" disabled>Select a subject</option>
           {mentor.subjects?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <small style={{ color: 'var(--text-muted)' }}>Student's weak topics: {student.weak_subjects?.join(', ')}</small>
      </div>

      <div className="form-group">
        <label className="form-label">Specific Topic</label>
        <input type="text" className="form-input" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} placeholder="e.g. Basic Fractions" />
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Date (from your Availability)</label>
          <select className="form-select" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value, time: ''})} required>
            <option value="" disabled>Select Date</option>
            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Time Slot</label>
          <select className="form-select" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required disabled={!formData.date}>
            <option value="" disabled>Select Time</option>
            {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Planned Activities</label>
        <textarea className="form-input" value={formData.activities} onChange={e => setFormData({...formData, activities: e.target.value})} placeholder="1. Teach theory... 2. Practice interactive... 3. Short quiz" rows={3}></textarea>
      </div>

      <div className="form-group">
        <label className="form-label">Location / Link</label>
        <input type="text" className="form-input" placeholder="e.g. Room 101 or Zoom Link" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} required />
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={!formData.date || !formData.time || !formData.place}>
        Confirm Booking
      </button>
      <p style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem', color: 'var(--text-muted)' }}>
        Note: You can only book sessions from the slots defined in your <strong>Availability Calendar</strong>.
      </p>
    </form>
  );
};

export default BookingForm;
