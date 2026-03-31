import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePortal } from '../context/PortalContext';
import { DownloadCloud, ArrowLeft, Award, Activity, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import BookingForm from '../components/BookingForm';
import SessionCard from '../components/SessionCard';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useEffect } from 'react';

const StudentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { students, sessions, dailyLogs } = usePortal();

  const student = students.find(s => s.id === id);
  const studentSessions = sessions.filter(s => s.student_id === id);
  const sLogs = dailyLogs?.filter(l => l.studentId === id) || [];

  const [showBooking, setShowBooking] = useState(false);
  const [lessonPlan, setLessonPlan] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    if (!student) return;
    const fetchPlan = async () => {
      try {
         let targetSubject = student.weak_subjects?.[0] || 'General';
         if (student.progressHistory && student.progressHistory.length > 0) {
             const subjectScores = {};
             student.progressHistory.forEach(h => {
                 if (h.subject && (!subjectScores[h.subject] || h.score < subjectScores[h.subject])) {
                     subjectScores[h.subject] = h.score;
                 }
             });
             if (Object.keys(subjectScores).length > 0) {
                 targetSubject = Object.keys(subjectScores).reduce((a, b) => subjectScores[a] < subjectScores[b] ? a : b);
             }
         }

         if (!navigator.onLine) throw new Error("Offline");
         const q = query(collection(db, 'lessonPlans'), 
            where('classLevel', '==', student.class),
            where('subject', '==', targetSubject)
         );
         const snap = await getDocs(q);
         if (!snap.empty) {
            const plan = { id: snap.docs[0].id, ...snap.docs[0].data() };
            setLessonPlan(plan);
         } else {
            // Provide a structured fallback if no plan exists in DB yet
            const mockPlan = {
               subject: targetSubject,
               topic: 'Foundations & Core Practice',
               goal: `Help ${student.name} master the basic concepts.`,
               steps: ['Introduce concept via real-world example', 'Guided practice (10 mins)', 'Independent quiz'],
               resources: 'Check internal portal documentation'
            };
            setLessonPlan(mockPlan);
         }
      } catch (e) {
         setOfflineMode(true);
         const cached = localStorage.getItem(`offline_lesson_${student.id}`);
         if (cached) setLessonPlan(JSON.parse(cached));
      }
    };
    fetchPlan();
  }, [student]);

  const saveOffline = () => {
    if (lessonPlan) {
       localStorage.setItem(`offline_lesson_${student.id}`, JSON.stringify(lessonPlan));
       alert("Lesson plan downloaded for Low Data / Offline Mode!");
    }
  };

  if (!student) {
    return <div className="animate-fade-in"><p>Student not found <button className="btn btn-secondary" onClick={()=>navigate('/dashboard')}>Go Back</button></p></div>;
  }

  // Quiz Trend Logic (Green = improving, Amber = stable, Red = declining)
  let trendColor = 'amber';
  let trendText = 'Stable';
  const lastScore = student.quizScores[student.quizScores.length - 1];
  const prevScore = student.quizScores[student.quizScores.length - 2];

  if (lastScore > prevScore) {
    trendColor = 'green';
    trendText = 'Improving';
  } else if (lastScore < prevScore) {
    trendColor = 'red';
    trendText = 'Declining';
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button className="btn" style={{ background: '#F3F4F6', border: '1px solid var(--border)' }} onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {student.name} <span className={`tag ${student.missedSessions > 1 ? 'danger' : 'success'}`}>{student.class}</span>
          </h1>
        </div>
        <div className="flex-center gap-2 glass-card" style={{ padding: '0.5rem 1rem', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)' }}>
            <Award size={20} />
            <span style={{ fontWeight: 'bold' }}>{student.points} pts</span>
        </div>
      </header>

      {student.missedSessions >= 2 && (
         <div className="glass-card flex-between" style={{ background: '#FEF2F2', borderLeft: '4px solid var(--danger)' }}>
           <div className="flex-center gap-2" style={{ color: 'var(--danger)' }}>
             <AlertTriangle size={20} />
             <strong>Risk Alert Formulated!</strong> 
             <span>This student has missed {student.missedSessions} recent sessions. Early intervention needed.</span>
           </div>
         </div>
      )}

      <div className="grid-2" style={{ gap: '2rem' }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-card">
            <h2 className="flex-center gap-2" style={{ justifyContent: 'flex-start' }}><Activity size={20}/> Performance & Progress</h2>
            
            <div className="flex-between" style={{ background: '#F9FAFB', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '1rem' }}>
               <div>
                 <p style={{ margin: 0, fontWeight: 500 }}>Recent Quiz Trend</p>
                 <div className="flex-center gap-2" style={{ marginTop: '0.5rem' }}>
                   <div className={`indicator ${trendColor}`}></div>
                   <span style={{ fontWeight: 600, fontSize: '1.2rem', textTransform: 'capitalize' }}>{trendText}</span>
                 </div>
               </div>
               
               <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>Last Score</p>
                  <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.5rem' }}>{lastScore}%</h3>
               </div>
            </div>

            <h3 style={{ marginTop: '1.5rem' }}>Badges Earned</h3>
            {student.badges.length > 0 ? (
               <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                 {student.badges.map(b => (
                   <span key={b} className="tag success flex-center gap-2"><Award size={14} /> {b}</span>
                 ))}
               </div>
            ) : <p>No badges earned yet.</p>}
          </div>

          <div className="glass-card">
            <h2 className="flex-center gap-2" style={{ justifyContent: 'flex-start' }}><Activity size={20}/> Overall Performance Summary</h2>
            <p style={{ marginTop: '1rem', lineHeight: '1.6', background: '#F9FAFB', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
              {student.overall_performance || "No performance summary available yet."}
            </p>

            <h3 style={{ marginTop: '2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={18} color="var(--primary)"/> Daily Progress Logs</h3>
            {sLogs.length > 0 ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--border)', paddingLeft: '1.5rem', marginLeft: '0.5rem' }}>
                  {sLogs.map((log, idx) => (
                     <div key={log.id} style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-32.5px', top: '0', background: 'var(--primary)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {sLogs.length - idx}
                        </div>
                        <div className="hover-scale" style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', transition: 'background 0.3s ease' }}>
                           <div className="flex-between">
                              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '0.95rem' }}>{new Date(log.date).toLocaleDateString()}</h4>
                              <span className="tag" style={{ background: '#E0E7FF', color: 'var(--primary)', fontSize: '0.75rem' }}>{log.duration}</span>
                           </div>
                           <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-muted)' }}>"{log.reflection}"</p>
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>No daily reflections submitted yet.</p>
            )}
          </div>

          <div className="glass-card">
            <h2 className="flex-center gap-2" style={{ justifyContent: 'flex-start' }}><BookOpen size={20}/> Areas of Focus</h2>
            <p>Topics requiring attention based on quiz performance.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {student.weak_subjects.map(sub => (
                <span key={sub} className="tag warning flex-center gap-2" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                  <AlertTriangle size={14} /> {sub}
                </span>
              ))}
            </div>
          </div>

          {lessonPlan && (
            <div className="glass-card" style={{ borderLeft: '4px solid var(--accent)' }}>
              <div className="flex-between">
                <h2 className="flex-center gap-2" style={{ margin: 0 }}><BookOpen size={20} color="var(--accent)"/> Structured Lesson Plan</h2>
                {offlineMode && <span className="tag warning">Low Data Mode</span>}
              </div>
              <div style={{ background: '#FFFBEB', padding: '1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid #FDE68A' }}>
                 {student.progress?.learningPath && (() => {
                     const nextNode = student.progress.learningPath.find(p => p.status === 'unlocked');
                     if (nextNode) return <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem', background: '#EFF6FF', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>Target Topic: {nextNode.title}</div>;
                     return null;
                 })()}
                 <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#92400E' }}>Topic: {lessonPlan.topic}</p>
                 <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#B45309' }}>Goal: {lessonPlan.goal}</p>
                 <hr style={{ border: 'none', borderTop: '1px solid #FDE68A', margin: '0.75rem 0' }}/>
                 <strong style={{ fontSize: '0.85rem', color: '#B45309' }}>Session Steps:</strong>
                 <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0', color: '#92400E' }}>
                   {lessonPlan.steps.map((st, i) => <li key={i} style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{st}</li>)}
                 </ul>
                 <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                   <button className="btn btn-secondary btn-sm" onClick={saveOffline} style={{ display: 'flex', gap: '0.25rem' }}><DownloadCloud size={14}/> Download Lesson</button>
                   {!offlineMode && <button className="btn btn-sm" style={{ background: '#FEF3C7', color: '#92400E' }}>Use this plan in session</button>}
                 </div>
              </div>
            </div>
          )}

          {student.progress?.learningPath && student.progress.learningPath.length > 0 && (
            <div className="glass-card">
              <h2 className="flex-center gap-2" style={{ justifyContent: 'flex-start' }}><Activity size={20} color="var(--primary)"/> Student Learning Path</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {student.progress.learningPath.map((node, i) => (
                  <div key={i} className="flex-between" style={{ padding: '0.75rem 1rem', background: node.status === 'completed' ? '#ECFDF5' : node.status === 'unlocked' ? '#EFF6FF' : '#F9FAFB', borderRadius: '8px', border: node.status === 'unlocked' ? '1px solid var(--primary)' : '1px solid transparent', opacity: node.status === 'locked' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                       <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: node.status === 'completed' ? 'var(--secondary)' : node.status === 'unlocked' ? 'var(--primary)' : '#9CA3AF', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>{i+1}</div>
                       <span style={{ fontSize: '0.95rem', color: node.status === 'locked' ? 'var(--text-muted)' : 'var(--text-main)', fontWeight: node.status !== 'locked' ? 600 : 400 }}>{node.title}</span>
                    </div>
                    <span className={`tag ${node.status === 'completed' ? 'success' : ''}`} style={{ fontSize: '0.75rem', background: node.status === 'locked' ? '#E5E7EB' : '' }}>{node.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
           <div className="glass-card">
             <div className="flex-between" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
               <h2>Session Booking</h2>
               <button className="btn btn-primary" onClick={() => setShowBooking(!showBooking)}>
                  <Clock size={16} /> {showBooking ? 'Cancel Booking' : 'Book Session'}
               </button>
             </div>

             {showBooking ? (
                <BookingForm student={student} onComplete={() => setShowBooking(false)}/>
             ) : (
                <>
                  <h3>History & Upcoming</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    {studentSessions.length > 0 ? studentSessions.map(sess => (
                        <SessionCard key={sess.id} session={sess} studentName={student.name} variant="studentInfo" />
                    )) : <p>No session history available.</p>}
                  </div>
                </>
             )}
           </div>
        </section>
      </div>
    </div>
  );
};

export default StudentDetails;
