import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePortal } from '../../context/PortalContext';
import { LogOut, BookOpen, Clock, Target, Calendar, Award, Activity, Star, AlertTriangle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';

const StudentDashboard = () => {
  const { currentUser, logout } = useAuth();
  const { requestReschedule, updateSessionStatus, addDoubt, leaderboard, submitAssignment, submitDailyLog, fetchQuizQuestions, submitQuizAttempt } = usePortal();
  const navigate = useNavigate();

  const [doubtText, setDoubtText] = useState('');
  const [dailyReflection, setDailyReflection] = useState('');
  const [studyDuration, setStudyDuration] = useState('1 to 2 hours');
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [dailyLogs, setDailyLogs] = useState([]);

  const [mentorName, setMentorName] = useState('Pending Assignment');
  const [mentorAvail, setMentorAvail] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [studentData, setStudentData] = useState(null);

  const [showQuiz, setShowQuiz] = useState(false);
  const [dailyQuizCompleted, setDailyQuizCompleted] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingSlot, setBookingSlot] = useState('');

  useEffect(() => {
    if (!currentUser) return;

    const studentRef = doc(db, 'students', currentUser.uid);
    const unsubStudent = onSnapshot(studentRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudentData(data);
        if (data.assignedMentorId) {
          const mSnap = await getDoc(doc(db, 'users', data.assignedMentorId));
          if (mSnap.exists()) setMentorName(mSnap.data().name);
          const mProf = await getDoc(doc(db, 'mentors', data.assignedMentorId));
          if (mProf.exists()) setMentorAvail(mProf.data().availability || []);
        }
      }
    });

    const qSessions = query(collection(db, 'sessions'), where('student_id', '==', currentUser.uid));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qAssignments = query(collection(db, 'assignments'), where('studentId', '==', currentUser.uid));
    const unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
      const asgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      asgs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAssignments(asgs);
    });

    const qLogs = query(collection(db, 'dailyLogs'), where('studentId', '==', currentUser.uid));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      setDailyLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const qAttempt = query(collection(db, 'quizAttempts'), where('studentId', '==', currentUser.uid), where('date', '==', todayStr));
    const unsubAttempt = onSnapshot(qAttempt, (snapshot) => {
      setDailyQuizCompleted(!snapshot.empty);
    });

    return () => { unsubStudent(); unsubSessions(); unsubAssignments(); unsubLogs(); unsubAttempt(); };
  }, [currentUser]);

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } 
    catch (err) { console.error(err); }
  };

  const handleOpenQuiz = async () => {
     if (dailyQuizCompleted) return;
     setQuizLoading(true);
     setShowQuiz(true);
     const questions = await fetchQuizQuestions(currentUser.uid);
     setQuizQuestions(questions);
     setUserAnswers({});
     setQuizSubmitted(false);
     setQuizLoading(false);
  };

  const handleTakeQuiz = async () => {
    if (!studentData || quizQuestions.length === 0) return;
    
    let correct = 0;
    quizQuestions.forEach((q, i) => {
       if (userAnswers[i] === q.correctAnswer) correct++;
    });
    
    const calculatedScore = Math.round((correct / quizQuestions.length) * 100);
    const questionsUsed = quizQuestions.map(q => q.id);
    
    await submitQuizAttempt(currentUser.uid, calculatedScore, questionsUsed);
    setQuizSubmitted(true);
    
    setTimeout(() => {
       setShowQuiz(false);
       setQuizSubmitted(false);
    }, 2500);
  };

  const submitDoubt = async (e) => {
    e.preventDefault();
    if (!doubtText.trim() || !studentData?.assignedMentorId) return;
    await addDoubt(studentData.assignedMentorId, doubtText);
    setDoubtText('');
  };

  const handleBookSession = async (e) => {
    e.preventDefault();
    if (!bookingSlot || !studentData?.assignedMentorId) return;
    
    const [date, time] = bookingSlot.split('|');
    await addDoc(collection(db, 'sessions'), {
      mentor_id: studentData.assignedMentorId,
      student_id: currentUser.uid,
      subject: "Mentorship Session",
      date,
      time,
      status: 'scheduled'
    });
    setBookingSlot('');
    setShowBooking(false);
  };

  const handleCompleteDay = async (e) => {
    e.preventDefault();
    if (!studentData?.assignedMentorId || !dailyReflection.trim()) return;
    const today = new Date().toISOString().split('T')[0];
    await submitDailyLog(currentUser.uid, studentData.assignedMentorId, today, dailyReflection, studyDuration);
    setShowDailyModal(false);
    setDailyReflection('');
  };

  const handleCompleteDailyChallenge = async () => {
     if (!studentData) return;
     const studentRef = doc(db, 'students', currentUser.uid);
     const newPoints = points + dailyChallenge.reward;
     let actLog = studentData.progress?.activityLog ? [...studentData.progress.activityLog] : Array.from({length:14}, ()=>0);
     actLog[actLog.length - 1] += 1;
     
     await updateDoc(studentRef, {
        "progress.dailyChallenge.completed": true,
        "progress.points": newPoints,
        "progress.activityLog": actLog
     });
     
     await setDoc(doc(db, "leaderboard", currentUser.uid), {
         points: newPoints
     }, { merge: true });
     
     alert(`Challenge completed! You earned ${dailyChallenge.reward} points!`);
  };

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const points = studentData?.progress?.points || 0;
  const badges = studentData?.progress?.badges || [];

  // Derived Fields
  const learningPath = studentData?.progress?.learningPath || [];
  const weakSubjects = studentData?.weakSubjects || [];
  const recoMessage = weakSubjects.length > 0 
    ? `You scored lower in ${weakSubjects[0]} recently. We recommend focused practice or scheduling a dedicated session.`
    : `You're doing great! Keep up the consistent work.`;
  const studyTime = studentData?.progress?.studyTime || { daily: 0, weekly: 0 };
  const dailyChallenge = studentData?.progress?.dailyChallenge;
  const quizScores = studentData?.progress?.quizScores || [];

  const renderActivityGraph = () => {
    const actLog = studentData?.progress?.activityLog || [];
    if (actLog.length < 2) return <p style={{ color: 'var(--text-muted)' }}>Not enough data for graph.</p>;
    const maxVal = Math.max(...actLog, 5); 
    
    return (
       <div style={{ display: 'flex', alignItems: 'flex-end', height: '100px', gap: '4px', marginTop: '1rem' }}>
          {actLog.map((val, i) => {
             const heightPct = (val / maxVal) * 100;
             return (
               <div key={i} className="hover-glow" style={{ flex: 1, background: val > 0 ? 'var(--secondary)' : '#E5E7EB', height: `${Math.max(heightPct, 5)}%`, borderRadius: '4px 4px 0 0', opacity: val > 0 ? 0.7 + (val*0.05) : 0.5 }} title={`Activity Score: ${val}`}></div>
             );
          })}
       </div>
    );
  };

  const renderGraph = () => {
    if (quizScores.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No quizzes taken yet.</p>;
    
    // Display up to last 6 scores to keep the UI clean
    const recentScores = quizScores.slice(-6);
    
    return (
       <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '12px', marginTop: '2rem', paddingBottom: '0', position: 'relative' }}>
          {/* subtle background lines for readability */}
          <div style={{ position: 'absolute', top: '10%', left: 0, right: 0, borderTop: '1px dashed #E5E7EB', zIndex: 0 }}></div>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px dashed #E5E7EB', zIndex: 0 }}></div>
          <div style={{ position: 'absolute', bottom: '0', left: 0, right: 0, borderBottom: '1px solid var(--border)', zIndex: 0 }}></div>

          {recentScores.map((score, i) => {
             const isLatest = i === recentScores.length - 1;
             
             return (
               <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', zIndex: 1 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isLatest ? 'var(--primary)' : 'var(--text-muted)', marginBottom: '6px' }}>{score}%</span>
                  <div className="hover-scale" style={{ 
                     width: '100%', 
                     maxWidth: '45px', 
                     height: `${Math.max(score, 10)}%`, 
                     background: isLatest ? 'var(--primary)' : '#93C5FD', 
                     borderRadius: '6px 6px 0 0',
                     transition: 'all 0.4s ease'
                  }} title={`Recent Attempt: ${score}%`}></div>
                  
                  {/* Added Weekly cadence labels per user request */}
                  <span style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: isLatest ? 'var(--primary)' : 'var(--text-muted)' }}>
                     {isLatest ? 'This Wk' : `Wk ${i + 1}`}
                  </span>
               </div>
             );
          })}
       </div>
    );
  };

  const pendingAsg = assignments.filter(a => a.status === 'pending');
  const completedAsg = assignments.filter(a => a.status === 'completed');

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.date === new Date().toLocaleDateString());
  const todayAssignments = pendingAsg.filter(a => a.dueDate === todayStr);
  const alreadySubmittedToday = dailyLogs.some(l => l.date === todayStr);

  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <header className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', borderRadius: 0, padding: '1rem 2rem' }}>
        <div className="flex-center gap-2 text-gradient">
          <BookOpen size={28} color="var(--primary)" />
          <h2>EduBridge Student Space</h2>
        </div>
        
        <div className="flex-center gap-4">
          <div className="flex-center gap-2 tag warning" style={{ padding: '0.4rem 1rem' }}>
            <Star size={18} /> {points} pts
          </div>
          <span style={{ fontWeight: 600 }}>{currentUser?.displayName || 'Student'}</span>
          <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="main-content animate-fade-in" style={{ padding: '2rem' }}>
        
        {/* Gamification / Badges Panel */}
        {(badges.length > 0 || studentData?.progress?.streak >= 5) && (
          <div className="glass-card hover-scale" style={{ marginBottom: '2rem', background: '#FEF3C7', border: '1px solid #FCD34D' }}>
            <div className="flex-center gap-2" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <Award size={20} color="#D97706" />
              <strong style={{ color: '#D97706' }}>Earned Badges:</strong>
              {badges.map(b => <span key={b} className="tag hover-glow" style={{ background: '#F59E0B', color: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{b}</span>)}
              {studentData?.progress?.streak >= 5 && <span className="tag hover-glow" style={{ background: '#EF4444', color: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>🔥 5-Day Streak</span>}
            </div>
          </div>
        )}

        <div className="glass-card" style={{ marginBottom: '2rem', background: 'var(--primary)', color: 'white', padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)' }}>
          <div>
            <h2 style={{ color: 'white', margin: '0 0 0.5rem 0', fontSize: '1.8rem' }}>Welcome back, {currentUser?.displayName?.split(' ')[0]}! 😊</h2>
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '0.75rem 1rem', borderRadius: '8px', marginTop: '1rem', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
               <h4 style={{ margin: '0 0 0.25rem 0', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Star size={16} /> Latest Performance Note
               </h4>
               <p style={{ color: '#E0E7FF', margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>
                 "{studentData?.progress?.overall_performance || 'Ready to crush your goals today?'}"
               </p>
               <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.9rem', color: '#C7D2FE' }}>
                 <span><strong style={{ color: 'white' }}>Total Score:</strong> {points} pts</span>
                 {quizScores.length > 0 && (
                    <span>• <strong style={{ color: 'white' }}>Latest Quiz:</strong> {quizScores[quizScores.length - 1]}%</span>
                 )}
               </div>
            </div>
          </div>
          <button className="btn btn-secondary hover-scale" onClick={handleOpenQuiz} disabled={dailyQuizCompleted} style={{ background: 'white', color: dailyQuizCompleted ? 'var(--text-muted)' : 'var(--primary)', alignSelf: 'flex-start', marginTop: '0.5rem', opacity: dailyQuizCompleted ? 0.7 : 1 }}>
            <Target size={18}/> {dailyQuizCompleted ? 'Daily Quiz Completed ✅' : 'Take Practice Quiz'}
          </button>
        </div>

        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Target size={20} color="var(--primary)" /> Daily Lesson Goal
            </h3>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>80% Completed</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
             <div style={{ width: '80%', height: '100%', background: 'var(--primary)', transition: 'width 1s ease-in-out' }}></div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-main)', textAlign: 'center', fontStyle: 'italic' }}>
             "Great job today! You're mapping out a fantastic streak. Keep pushing!"
          </p>
        </div>

        <div className="grid-2" style={{ alignItems: 'start', gridTemplateColumns: '1.5fr 1fr' }}>
          
          {/* LEFT COLUMN - Core Learning */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
             {/* Assigned Mentor Info */}
             <div className="glass-card hover-scale" style={{ borderLeft: '4px solid var(--secondary)', marginBottom: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}><Star size={18}/> My Assigned Mentor</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                      {mentorName !== 'Pending Assignment' ? mentorName.charAt(0).toUpperCase() : '?'}
                   </div>
                   <div>
                       <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{mentorName}</h4>
                       <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                         {mentorName !== 'Pending Assignment' ? 'Automatically matched based on your chosen subjects!' : 'We are finding the perfect mentor for you based on your subjects.'}
                       </p>
                   </div>
                </div>
             </div>

             {/* Smart Reco */}
             <div className="glass-card hover-scale" style={{ borderLeft: '4px solid var(--accent)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}><Target size={18}/> Focus Area Today</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{recoMessage}</p>
             </div>

             {/* Learning Path */}
             <div className="glass-card">
                <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={18} color="var(--primary)"/> My Learning Path</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {learningPath.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', background: '#F9FAFB', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                       <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>We are currently building your personalized learning path based on your subjects...</p>
                    </div>
                  ) : (
                    learningPath.map((node, i) => (
                      <div key={node.id} className="flex-between hover-scale" style={{ padding: '0.75rem 1rem', background: node.status === 'locked' ? '#F9FAFB' : node.status === 'completed' ? '#ECFDF5' : '#EEF2FF', borderRadius: '8px', opacity: node.status === 'locked' ? 0.6 : 1, border: node.status === 'unlocked' ? '1px solid var(--primary)' : '1px solid transparent' }}>
                         <div className="flex-center gap-3">
                             <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: node.status === 'completed' ? 'var(--secondary)' : node.status === 'unlocked' ? 'var(--primary)' : '#9CA3AF', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>{i+1}</div>
                             <span style={{ fontWeight: 500, color: node.status === 'locked' ? 'var(--text-muted)' : 'var(--text-main)', fontSize: '0.95rem' }}>{node.title}</span>
                         </div>
                         <span className={`tag ${node.status === 'completed' && 'success'} ${node.status === 'locked' && ''}`} style={{ fontSize: '0.75rem', background: node.status === 'locked' ? '#E5E7EB' : '' }}>
                           {node.status.toUpperCase()}
                         </span>
                      </div>
                    ))
                  )}
                </div>
             </div>

             {/* Performance Graph */}
             {quizScores.length > 0 && (
               <div className="glass-card">
                  <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={18} color="var(--primary)"/> My Quiz Scores Trend</h3>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>This chart tracks your recent practice quiz scores. It visually maps your academic growth so you and your mentor can easily see your improvement over time.</p>
                  {renderGraph()}
               </div>
             )}

             {/* Assignments Block */}
             <div className="glass-card" style={{ borderLeft: '4px solid #10B981' }}>
               <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                 <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BookOpen size={20} color="#10B981"/> My Assignments
                 </h2>
                 <span className="tag" style={{ background: '#ECFDF5', color: '#047857', fontWeight: 600 }}>{pendingAsg.length} Pending</span>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                 <div>
                   <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem', marginTop: 0 }}>Tasks to Complete ({pendingAsg.length})</h3>
                   {pendingAsg.length === 0 ? (
                     <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>You're all caught up!</p>
                   ) : (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                       {pendingAsg.map(a => (
                         <div key={a.id} className="flex-between hover-scale" style={{ padding: '1rem', background: '#FEF3C7', borderLeft: '4px solid #F59E0B', borderRadius: '8px' }}>
                           <div>
                             <h4 style={{ margin: '0 0 0.25rem 0', color: '#92400E' }}>{a.title}</h4>
                             <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#B45309' }}>{a.description}</p>
                             <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#D97706' }}>Due: {a.dueDate} || Subj: {a.subject}</span>
                           </div>
                           <button className="btn btn-secondary btn-sm" style={{ background: '#F59E0B', color: 'white', minWidth: '130px' }} onClick={() => submitAssignment(a.id, currentUser.uid)}>
                             + Submit Task
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                 {completedAsg.length > 0 && (
                   <div>
                     <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Completed Submissions</h3>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                       {completedAsg.slice(0, 3).map(a => (
                         <div key={a.id} className="flex-between hover-scale" style={{ padding: '0.75rem 1rem', background: '#ECFDF5', borderLeft: '4px solid #10B981', borderRadius: '8px' }}>
                           <div>
                             <h4 style={{ margin: '0 0 0.25rem 0', color: '#065F46' }}>
                               {a.title} <span className="tag success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>✓</span>
                             </h4>
                             <span style={{ fontSize: '0.8rem', color: '#047857' }}>Points Earned: +{a.score} Pts</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             </div>
             
             {/* Mentorship Schedule */}
             <div className="glass-card">
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>My Mentorship Schedule</h2>
                <button className="btn btn-primary btn-sm hover-scale" onClick={() => setShowBooking(!showBooking)}>
                  <Plus size={16}/> {showBooking ? 'Cancel Booking' : 'Book Session'}
                </button>
              </div>

              {showBooking && (
                <form onSubmit={handleBookSession} style={{ background: '#F9FAFB', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--primary)' }}>
                  <h3 style={{ marginTop: 0 }}>Book with {mentorName}</h3>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Available Slots</label>
                    <select className="form-select" value={bookingSlot} onChange={e => setBookingSlot(e.target.value)} required>
                      <option value="">-- Select an available slot --</option>
                      {mentorAvail.length > 0 ? mentorAvail.map((av, idx) => (
                        <option key={idx} value={`${av.date}|${av.time}`}>{av.date} at {av.time}</option>
                      )) : <option disabled>No availability configured by mentor.</option>}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!bookingSlot}><Clock size={16}/> Confirm Booking</button>
                </form>
              )}

              {sessions.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Clock size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                  <h3>No sessions scheduled yet!</h3>
                  <p>Book a session with your mentor to get started.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sessions.map(s => (
                    <div key={s.id} className="flex-between hover-scale" style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div>
                        <h4 style={{ color: 'var(--text-main)', display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0 0 0.25rem 0' }}>
                          {s.subject || "General Mentorship"}
                          {s.status === 'reschedule_requested' && <span className="tag warning">Reschedule Requested</span>}
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>{s.date} at {s.time}</p>
                      </div>
                      <div className="flex-center gap-2">
                        {s.status === 'pending' ? (
                          <>
                            <span className="tag warning">ACTION REQUIRED</span>
                            <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => updateSessionStatus(s.id, 'scheduled')}>Accept</button>
                            <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#FEE2E2', color: 'var(--danger)' }} onClick={() => updateSessionStatus(s.id, 'rejected')}>Reject</button>
                          </>
                        ) : (
                          <>
                            <span className={`tag ${s.status === 'completed' ? 'success' : s.status === 'missed' || s.status === 'rejected' ? 'danger' : 'primary'}`}>
                              {s.status.toUpperCase()}
                            </span>
                            {s.status === 'scheduled' && (
                              <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => requestReschedule(s.id)}>Reschedule</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN - Gamification & Engagement */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
             {/* Daily Planner */}
             <div className="glass-card hover-glow" style={{ borderLeft: '4px solid var(--primary)' }}>
                <div className="flex-between">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <Calendar size={20} color="var(--primary)"/> My Daily Planner
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date().toDateString()}</span>
                </div>
                
                <div style={{ margin: '1rem 0', padding: '1rem', background: '#F9FAFB', borderRadius: '8px', border: '1px solid var(--border)' }}>
                   <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, fontSize: '0.9rem' }}>Today's Tasks:</p>
                   <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {todaySessions.length > 0 ? todaySessions.map(s => <li key={s.id}><strong>Session:</strong> {s.time} - {s.subject}</li>) : null}
                      {todayAssignments.length > 0 ? todayAssignments.map(a => <li key={a.id}><strong>Due Today:</strong> {a.title}</li>) : null}
                      {todaySessions.length === 0 && todayAssignments.length === 0 && (
                        <li><strong>Focus Area:</strong> Check your Learning Path or practice quizzes!</li>
                      )}
                   </ul>
                </div>

                {alreadySubmittedToday ? (
                   <div className="flex-center gap-2" style={{ padding: '0.75rem', background: '#ECFDF5', color: '#047857', border: '1px solid #34D399', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                      <Award size={18} /> Day's Reflection Submitted!
                   </div>
                ) : (
                   <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowDailyModal(true)}>
                     Complete My Day (+20 pts)
                   </button>
                )}
             </div>

             {/* Daily Challenge */}
             {dailyChallenge && (
               <div className="glass-card hover-glow" style={{ background: dailyChallenge.completed ? '#D1FAE5' : 'var(--surface)', border: dailyChallenge.completed ? '1px solid #34D399' : '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: dailyChallenge.completed ? 'var(--secondary)' : 'var(--text-main)' }}><Award size={18} color={dailyChallenge.completed ? "var(--secondary)" : "var(--accent)"}/> Daily Challenge</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{dailyChallenge.task}</p>
                  <div className="flex-between" style={{ marginTop: '1rem' }}>
                    <span className="tag" style={{ background: '#FEF3C7', color: '#B45309' }}>+{dailyChallenge.reward} pts</span>
                    {dailyChallenge.completed ? (
                       <span className="tag success">✓ Completed</span>
                    ) : (
                       <button className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={handleCompleteDailyChallenge}>Complete Now</button>
                    )}
                  </div>
               </div>
             )}

             {/* Study Time Tracker */}
             <div className="glass-card grid-2" style={{ gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                   <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Daily Study Time</p>
                   <h2 style={{ margin: 0, color: 'var(--primary)' }}>{studyTime.daily} <span style={{fontSize:'1rem'}}>min</span></h2>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)' }}>
                   <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Weekly Study Time</p>
                   <h2 style={{ margin: 0, color: 'var(--secondary)' }}>{studyTime.weekly} <span style={{fontSize:'1rem'}}>min</span></h2>
                </div>
             </div>
             
             {/* Doubt System */}
             <div className="glass-card">
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={18} color="var(--primary)"/> Ask a Doubt</h3>
                <form onSubmit={submitDoubt}>
                   <textarea className="form-input" rows="3" placeholder="Describe your doubt here..." value={doubtText} onChange={e => setDoubtText(e.target.value)} required style={{ resize: 'none' }}></textarea>
                   <button type="submit" className="btn btn-primary hover-scale" style={{ width: '100%', marginTop: '0.5rem' }}>Send to Mentor</button>
                </form>
             </div>
           </div>
        </div>

        {showQuiz && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="glass-card animate-fade-in" style={{ width: '500px', background: 'white', maxHeight: '80vh', overflowY: 'auto' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target color="var(--primary)"/> Daily Practice Challenge</h2>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Complete these {quizQuestions.length} questions to track your progress and earn points!</p>
              
              {quizLoading ? (
                 <div style={{ padding: '2rem', textAlign: 'center' }}>Loading your daily questions...</div>
              ) : quizSubmitted ? (
                 <div style={{ padding: '2rem', textAlign: 'center', color: '#10B981', fontWeight: 'bold' }}>
                    Quiz submitted! Calculating your score...
                 </div>
              ) : quizQuestions.length === 0 ? (
                 <div style={{ padding: '2rem', textAlign: 'center' }}>No questions available right now.</div>
              ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {quizQuestions.map((q, qIndex) => (
                       <div key={q.id} style={{ background: '#F9FAFB', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                             <span className="tag" style={{ background: '#E0E7FF', color: 'var(--primary)', fontSize: '0.75rem' }}>{q.subject}</span>
                             <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Q{qIndex + 1}</span>
                          </div>
                          <p style={{ fontWeight: 600, margin: '0 0 1rem 0', color: 'var(--text-main)' }}>{q.question}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {q.options.map((opt, optIdx) => (
                               <label key={optIdx} className="hover-scale" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', background: userAnswers[qIndex] === opt ? '#EFF6FF' : 'white', border: userAnswers[qIndex] === opt ? '1px solid var(--primary)' : '1px solid var(--border)', borderRadius: '6px' }}>
                                 <input type="radio" name={`q_${q.id}`} value={opt} checked={userAnswers[qIndex] === opt} onChange={() => setUserAnswers({...userAnswers, [qIndex]: opt})} style={{ margin: 0 }}/>
                                 <span style={{ fontSize: '0.9rem' }}>{opt}</span>
                               </label>
                            ))}
                          </div>
                       </div>
                    ))}
                 </div>
              )}

              {!quizLoading && !quizSubmitted && quizQuestions.length > 0 && (
                <div className="flex-between">
                  <button className="btn" style={{ background: '#F3F4F6' }} onClick={() => setShowQuiz(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleTakeQuiz} disabled={Object.keys(userAnswers).length < quizQuestions.length}>Submit Answers</button>
                </div>
              )}
            </div>
          </div>
        )}

        {showDailyModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="glass-card animate-fade-in" style={{ width: '500px', background: 'white', padding: '2rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.5rem 0' }}><BookOpen color="var(--primary)"/> Complete Your Day</h2>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Reflect on your progress today to earn your daily points and keep your mentor updated.</p>
              
              <form onSubmit={handleCompleteDay}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">How long did you study today?</label>
                  <select className="form-select" value={studyDuration} onChange={(e) => setStudyDuration(e.target.value)} required>
                    <option value="under 1 hour">Under 1 hour</option>
                    <option value="1 to 2 hours">1 to 2 hours</option>
                    <option value="2 to 4 hours">2 to 4 hours</option>
                    <option value="4+ hours">4+ hours</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">What did you actually accomplish or learn today?</label>
                  <textarea className="form-input" rows="4" placeholder="Be specific about modules completed, homework done, or doubts cleared..." value={dailyReflection} onChange={(e) => setDailyReflection(e.target.value)} required style={{ resize: 'vertical' }}></textarea>
                </div>

                <div className="flex-between">
                  <button type="button" className="btn" style={{ background: '#F3F4F6' }} onClick={() => setShowDailyModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={!dailyReflection.trim()}>Submit Reflection (+20 pts)</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;
