import React, { useState } from 'react';
import { Calendar, Clock, BookOpen, AlertTriangle, CheckCircle, FileText, MapPin, Users } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { useNavigate } from 'react-router-dom';

const SessionCard = ({ session, studentName, variant = "dashboard" }) => {
  const { students, handleReschedule, submitSessionReport, markSessionMissed } = usePortal();
  const navigate = useNavigate();
  const [isReporting, setIsReporting] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showStudents, setShowStudents] = useState(false);
  
  // Structured Session Flow Trackers
  const [teachCompleted, setTeachCompleted] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const isReschedule = session.status === 'reschedule_requested';
  const student = students.find(s => s.id === session.student_id);

  const handleSubmitReport = async () => {
    if (!teachCompleted || !practiceCompleted || !quizCompleted) {
       alert("Please confirm all required session steps (Teach, Practice, Quiz) are completed before submitting the report.");
       return;
    }
    if (reportText.trim()) {
      const sId = session.student_id || session.studentId;
      await submitSessionReport(session.id, sId, reportText);
      setIsReporting(false);
    }
  };

  return (
    <div className="glass-card flex-between" style={{ borderLeft: isReschedule ? '4px solid var(--accent)' : session.status === 'missed' ? '4px solid var(--danger)' : '4px solid var(--primary)', marginBottom: '1rem', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {variant === 'dashboard' ? 'Scheduled Class' : studentName} 
          {isReschedule && <span className="tag warning"><AlertTriangle size={12}/> Reschedule Requested</span>}
        </h4>
        
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span className="flex-center gap-2"><BookOpen size={16}/> {session.subject}</span>
          <span className="flex-center gap-2"><Calendar size={16}/> {session.date}</span>
          <span className="flex-center gap-2"><Clock size={16}/> {session.time}</span>
          {session.place && <span className="flex-center gap-2"><MapPin size={16}/> {session.place}</span>}
          {student && <span className="flex-center gap-2"><Users size={16}/> {student.class}</span>}
          {student?.progress?.learningPath && (() => {
             const nextNode = student.progress.learningPath.find(p => p.status === 'unlocked');
             if (nextNode) return <span className="flex-center gap-2 tag primary" style={{ padding: '0.1rem 0.5rem', background: '#EFF6FF', color: 'var(--primary)' }}>Next Topic: {nextNode.title}</span>;
             return null;
          })()}
        </div>

        {isReschedule && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: '#F9FAFB', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem' }}>
            Reason: {session.rescheduleReason}
          </p>
        )}

        {session.topic && (
           <div style={{ marginTop: '0.75rem', background: '#FDF4FF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #F5D0FE' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#C026D3', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✨ AI Scheduled Topic: {session.topic}</p>
              {session.activities && (
                 <p style={{ margin: 0, fontSize: '0.85rem', color: '#86198F', whiteSpace: 'pre-line' }}>{session.activities}</p>
              )}
           </div>
        )}

        {showStudents && (
          <div className="animate-fade-in" style={{ marginTop: '1rem', background: '#F9FAFB', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>Enrolled Students</p>
            <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem' }} onClick={() => navigate(`/student/${student.id}`)}>
              <span>{studentName}</span>
              <span style={{ fontSize: '0.8rem' }}>View Profile &rarr;</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, minWidth: '150px', textAlign: 'right', marginLeft: '1.5rem' }}>
        {isReschedule ? (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn" style={{ background: '#D1FAE5', color: 'var(--secondary)' }} onClick={() => handleReschedule(session.id, 'approve')}>Approve</button>
            <button className="btn btn-danger" onClick={() => handleReschedule(session.id, 'reject')}>Reject</button>
          </div>
        ) : isReporting ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
            <div style={{ background: '#F9FAFB', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '0.5rem' }}>
               <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between' }}>
                 <span>Enforce Session Flow</span>
                 <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Teach &rarr; Practice &rarr; Quiz</span>
               </h5>
               <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={teachCompleted} onChange={() => setTeachCompleted(!teachCompleted)}/> Teach
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={practiceCompleted} onChange={() => setPracticeCompleted(!practiceCompleted)}/> Practice
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={quizCompleted} onChange={() => setQuizCompleted(!quizCompleted)}/> Quiz
                  </label>
               </div>
            </div>
            <textarea className="form-input" rows="3" placeholder="Write the session report here..." value={reportText} onChange={e => setReportText(e.target.value)} style={{ width: '100%', minWidth: '300px' }}></textarea>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button className="btn" style={{ background: '#F3F4F6' }} onClick={() => setIsReporting(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmitReport} 
                disabled={!reportText.trim() || !teachCompleted || !practiceCompleted || !quizCompleted}
                title={(!teachCompleted || !practiceCompleted || !quizCompleted) ? "Please complete all session steps first" : ""}
              >
                <CheckCircle size={16}/> Submit Report
              </button>
            </div>
          </div>
        ) : session.status === 'completed' ? (
          <div className="flex-center gap-2" style={{ color: 'var(--secondary)' }}><CheckCircle size={16}/> Completed</div>
        ) : session.status === 'missed' ? (
          <div className="flex-center gap-2" style={{ color: 'var(--danger)' }}><AlertTriangle size={16}/> Missed</div>
        ) : variant === 'studentInfo' ? (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-danger" onClick={() => markSessionMissed(session.student_id, session.id)} title="Mark as No Show">
              <AlertTriangle size={16}/> Missed
            </button>
            <button className="btn btn-secondary" onClick={() => setIsReporting(true)}>
              <FileText size={16}/> Submit Report
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowStudents(!showStudents)}>
            {showStudents ? 'Hide Details' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
};

export default SessionCard;
