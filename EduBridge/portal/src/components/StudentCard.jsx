import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight, Award, Flame, CalendarPlus, Activity, TrendingUp } from 'lucide-react';
import { usePortal } from '../context/PortalContext';

const StudentCard = ({ student }) => {
  const navigate = useNavigate();
  const { availability, requestExtraSession } = usePortal();
  
  const [showBooking, setShowBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const availableDates = Object.keys(availability || {}).filter(d => availability[d].length > 0);
  const availableTimes = selectedDate ? availability[selectedDate] || [] : [];

  const pastDays = Array.from({ length: 14 }, (_, i) => {
    let d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString();
  });

  // Compute Activity Metrics
  const weeklyCount = student.activityLog?.slice(-7).filter(x => x > 0).length || 0;
  
  let riskLevel = 'green';
  let riskText = 'Active';
  
  if (weeklyCount < 3) {
    riskLevel = 'amber';
    riskText = 'Moderate';
  }
  if (student.streak === 0 || student.missedSessions >= 2 || weeklyCount === 0) {
    riskLevel = 'red';
    riskText = 'At Risk';
  }

  const Heatmap = () => (
    <div style={{ display: 'flex', gap: '3px', marginTop: '0.5rem', alignItems: 'center' }}>
      <Activity size={14} color="var(--text-muted)" style={{ marginRight: '4px' }}/>
      {student.activityLog?.map((val, i) => {
        let op = 1; let bg = '#E5E7EB';
        if (val > 0) {
          bg = 'var(--primary)';
          op = Math.min(0.4 + (val * 0.2), 1); // 1->0.6, 2->0.8, 3+->1.0
        }
        return (
          <div key={i} className="hover-scale" style={{ 
            width: '12px', height: '12px', borderRadius: '2px', 
            background: bg, opacity: op, cursor: 'pointer', transition: 'transform 0.2s'
          }} title={`${pastDays[i]}: ${val} activities`} />
        );
      })}
    </div>
  );

  return (
    <div className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="flex-between">
        <h3 style={{ margin: 0 }}>{student.name}</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {(() => {
             const qs = student.quizScores || [];
             if (qs.length >= 2) {
               const last = qs[qs.length - 1];
               const prev = qs[qs.length - 2];
               if (last > prev) return <TrendingUp size={16} color="var(--success)" title="Improving Options" />;
               if (last < prev) return <TrendingUp size={16} color="var(--danger)" style={{ transform: 'scaleY(-1)' }} title="Declining Options" />;
             }
             return null;
          })()}
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{riskText}</span>
          <div className={`indicator ${riskLevel}`}></div>
        </div>
      </div>
      
      <div>
        <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          <span>Class: <strong>{student.class}</strong></span>
          <span className="flex-center gap-2" style={{ color: 'var(--accent)', fontWeight: 600 }}>
             <Flame size={14} /> {student.streak} Day Streak
          </span>
        </div>
        
        <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)' }}>
          Last active: {student.lastActiveDate} &bull; {weeklyCount} sessions this week
        </p>

        {student.overall_performance && (
          <div style={{ background: '#F9FAFB', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-main)', borderLeft: '3px solid var(--primary)', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
             "{student.overall_performance.length > 70 ? student.overall_performance.substring(0, 70) + '...' : student.overall_performance}"
          </div>
        )}
        
        <Heatmap />
        
        {riskLevel === 'red' && (
           <div className="flex-center gap-2" style={{ background: '#FEF2F2', color: 'var(--danger)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginTop: '0.75rem' }}>
             <AlertCircle size={14} /> Needs Attention
           </div>
        )}
      </div>

      <div className="flex-between" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <button className="btn" style={{ padding: '0.4rem', fontSize: '0.85rem', background: '#F3F4F6' }} onClick={() => setShowBooking(!showBooking)} title="Schedule Extra Session">
          <CalendarPlus size={16} /> 
        </button>
        <button 
          className="btn btn-primary" 
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          onClick={() => navigate(`/student/${student.id}`)}
        >
          View Profile <ChevronRight size={14} />
        </button>
      </div>

      {showBooking && (
         <div className="animate-fade-in" style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
            <p style={{ margin: 0, marginBottom: '0.5rem', fontWeight: 600 }}>Schedule Intervention Session</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <select className="form-select" style={{ padding: '0.4rem' }} value={selectedDate} onChange={e => {setSelectedDate(e.target.value); setSelectedTime('')}}>
                <option value="" disabled>Select Date...</option>
                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className="form-select" style={{ padding: '0.4rem' }} value={selectedTime} onChange={e => setSelectedTime(e.target.value)} disabled={!selectedDate}>
                <option value="" disabled>Select Time...</option>
                {availableTimes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: '0.4rem' }} disabled={!selectedDate || !selectedTime} onClick={async () => { 
                  try {
                    await requestExtraSession(student.id, selectedDate, selectedTime); 
                    setShowBooking(false); 
                  } catch(e) {
                    alert(e.message);
                  }
                }}>Send Request</button>
              </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default StudentCard;
