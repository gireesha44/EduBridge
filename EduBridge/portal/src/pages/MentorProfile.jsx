import React, { useState } from 'react';
import { usePortal } from '../context/PortalContext';
import { Save, CalendarPlus, Plus } from 'lucide-react';

const MentorProfile = () => {
  const { mentor, updateMentorProfile, availability, addAvailability } = usePortal();
  const [formData, setFormData] = useState(mentor);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Availability form state
  const [newAvail, setNewAvail] = useState({ date: '', time: '' });
  const [availSuccess, setAvailSuccess] = useState(false);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    updateMentorProfile(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAvailSubmit = (e) => {
    e.preventDefault();
    if(newAvail.date && newAvail.time) {
      addAvailability(newAvail.date, newAvail.time);
      setNewAvail({ date: '', time: '' });
      setAvailSuccess(true);
      setTimeout(() => setAvailSuccess(false), 3000);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      <header>
        <h1 className="text-gradient">Mentor Settings & Availability</h1>
        <p>Manage your public profile information and schedule slots.</p>
      </header>

      <div className="grid-2">
        <section className="glass-card">
          <div className="flex-between" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <h2>Profile Setup</h2>
            {saveSuccess && <span className="tag success">Saved successfully!</span>}
          </div>

          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>

            <div className="form-group">
              <label className="form-label">Subjects (comma separated)</label>
              <input type="text" className="form-input" value={formData.subjects.join(', ')} onChange={e => setFormData({...formData, subjects: e.target.value.split(',').map(s=>s.trim())})} required />
             </div>

            <div className="form-group">
              <label className="form-label">Target Age Group</label>
              <input type="text" className="form-input" value={formData.ageGroup} onChange={e => setFormData({...formData, ageGroup: e.target.value})} required />
             </div>

            <div className="form-group">
              <label className="form-label">Educational Qualifications</label>
              <textarea className="form-input" rows="3" value={formData.qualifications} onChange={e => setFormData({...formData, qualifications: e.target.value})} required></textarea>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <Save size={18} /> Save Profile
            </button>
          </form>
        </section>

        <section>
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h2>Add Availability slot</h2>
              {availSuccess && <span className="tag success">Slot Added!</span>}
            </div>

            <form onSubmit={handleAvailSubmit} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={newAvail.date} onChange={e => setNewAvail({...newAvail, date: e.target.value})} required/>
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">Time</label>
                <input type="time" className="form-input" value={newAvail.time} onChange={e => setNewAvail({...newAvail, time: e.target.value})} required/>
              </div>
              <button type="submit" className="btn btn-secondary" style={{ padding: '0.75rem 1rem' }}>
                <Plus size={18} /> Add
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h2>Current Availability Calendar</h2>
            <p style={{ marginBottom: '1.5rem' }}>Your current scheduled free slots</p>
            
            {Object.keys(availability).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {Object.entries(availability).map(([date, slots]) => (
                   <div key={date} style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '8px' }}>
                     <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                       <CalendarPlus size={16} /> {date}
                     </h4>
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                       {slots.map(slot => (
                          <span key={slot} className="tag">{slot}</span>
                       ))}
                     </div>
                   </div>
                 ))}
              </div>
            ) : (
              <p>No availability added yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MentorProfile;
