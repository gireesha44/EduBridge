import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, BookOpen, Users, Link as LinkIcon, AlertCircle, AlertTriangle, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, addDoc, deleteDoc } from 'firebase/firestore';
import { evaluatePerformance, suggestMentor } from '../../services/aiService';

const NGODashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [studentStats, setStudentStats] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [pendingMentors, setPendingMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddMentor, setShowAddMentor] = useState(false);
  const [mentorForm, setMentorForm] = useState({ name: '', email: '', subjects: '' });
  const [reassignmentAlerts, setReassignmentAlerts] = useState([]);
  const [isMatching, setIsMatching] = useState(false);

  // Form State (Assignments now handled automatically during Signup)

  useEffect(() => {
    // Fetch Students Base
    const studentQuery = query(collection(db, "users"), where("role", "==", "Student"));
    const unsubStudents = onSnapshot(studentQuery, async (snapshot) => {
      const studentDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentDocs);
    });

    // Fetch Student Tracking Data
    const unsubStudentStats = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudentStats(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Mentors from their explicit document tracking node to get calculated metrics
    const unsubMentors = onSnapshot(collection(db, "mentors"), (snapshot) => {
      const mentorDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMentors(mentorDocs);
      setLoading(false);
    });

    // Fetch Pending Authorizations
    const unsubPending = onSnapshot(collection(db, "pendingMentors"), (snapshot) => {
      setPendingMentors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStudents();
      unsubStudentStats();
      unsubMentors();
      unsubPending();
    };
  }, []);

  const handleAddMentor = async (e) => {
    e.preventDefault();
    if (!mentorForm.name || !mentorForm.email || !mentorForm.subjects) return;
    try {
      await addDoc(collection(db, "pendingMentors"), {
        name: mentorForm.name,
        email: mentorForm.email.toLowerCase().trim(),
        subjects: mentorForm.subjects.split(',').map(s => s.trim()),
        createdAt: new Date().toISOString(),
        isApproved: true
      });
      setMentorForm({name: '', email: '', subjects: ''});
      setShowAddMentor(false);
    } catch(err) { console.error(err); }
  };

  const removePendingMentor = async (id) => {
    try { await deleteDoc(doc(db, "pendingMentors", id)); } catch(e) {}
  };

  const removeActiveMentor = async (id) => {
    if(window.confirm("Are you sure you want to deactivate this mentor from the platform?")) {
       try { 
         const uSnap = await getDoc(doc(db, "users", id));
         if(uSnap.exists()) await deleteDoc(doc(db, "users", id)); 
         await deleteDoc(doc(db, "mentors", id)); 
       } catch(e){}
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGlobalMatch = async () => {
    setIsMatching(true);
    let matchedCount = 0;
    try {
      const activeUnassigned = mappedStudents.filter(s => {
         const mId = s.stats?.assignedMentorId;
         return !mId || !mentors.find(m => m.id === mId);
      });
      if (activeUnassigned.length === 0) {
        alert("All existing students already have active mentors!");
        setIsMatching(false);
        return;
      }

      for (const s of activeUnassigned) {
         const stPayload = { ...s.stats, classLevel: s.stats?.classLevel || 'Class 10' };
         // Filter out full mentors (max capacity 5)
         const availableCapacityMentors = mentors.filter(m => (m.assignedStudents?.length || 0) < 5);
         if (availableCapacityMentors.length === 0) break; 

         const assignedId = await suggestMentor(stPayload, availableCapacityMentors);
         
         if (assignedId) {
            await updateDoc(doc(db, "students", s.id), {
               assignedMentorId: assignedId,
               matchingReason: ["Batch API match", "subject required"]
            });
            await updateDoc(doc(db, "mentors", assignedId), {
               assignedStudents: arrayUnion(s.id)
            });
            matchedCount++;
         }
      }
      alert(`Success! Automatically assigned ${matchedCount} existing student(s).`);
    } catch (err) {
      console.error(err);
      alert("Error during global matching.");
    } finally {
      setIsMatching(false);
    }
  };


  // Compute Risk Alerts
  const mappedStudents = students.map(u => {
    const stats = studentStats.find(s => s.id === u.id);
    return { ...u, stats };
  });

  useEffect(() => {
     if(mappedStudents.length === 0 || mentors.length === 0) return;
     
     const checkReassignments = async () => {
        let alerts = [];
        for (const s of mappedStudents) {
           const history = s.stats?.progressHistory || [];
           if (history.length >= 3) {
              const now = Date.now();
              const last14 = history.filter(h => (now - new Date(h.date).getTime()) <= 14 * 86400000);
              const prev14 = history.filter(h => {
                 const diff = now - new Date(h.date).getTime();
                 return diff > 14 * 86400000 && diff <= 28 * 86400000;
              });
              
              const avgA = last14.length ? last14.reduce((sum, h) => sum + h.score, 0) / last14.length : 0;
              const avgB = prev14.length ? prev14.reduce((sum, h) => sum + h.score, 0) / prev14.length : avgA; 
              
              if (avgB > 0 && (avgA - avgB) < 5) { // < 5% improvement or decline
                 
                 const oldMentorId = s.stats.assignedMentorId;
                 const subjectNeeded = s.stats.weakSubjects?.[0] || '';
                 const candidateMentors = mentors.filter(m => m.id !== oldMentorId && m.subjects?.includes(subjectNeeded) && (m.assignedStudents?.length || 0) < 5);
                 candidateMentors.sort((a,b) => (b.performanceScore || 0) - (a.performanceScore || 0));
                 
                 if (candidateMentors.length > 0) {
                     const newMentor = candidateMentors[0];
                     const aiEval = await evaluatePerformance(s);
                     const trend = aiEval?.improvementTrend || "stagnant";
                     const riskFormat = aiEval?.riskLevel || "medium";
                     
                     await updateDoc(doc(db, "students", s.id), { 
                         assignedMentorId: newMentor.id,
                         reassignmentReason: `AI Assessed: ${riskFormat.toUpperCase()} risk, ${trend} trend.`,
                         matchingReason: ["subject", "performance", "availability"]
                     });
                     
                     if (oldMentorId) {
                         const oldMRef = doc(db, "mentors", oldMentorId);
                         const oldM = mentors.find(m => m.id === oldMentorId);
                         if(oldM && oldM.assignedStudents) {
                            await updateDoc(oldMRef, { assignedStudents: oldM.assignedStudents.filter(id => id !== s.id) });
                         }
                     }
                     
                     const newMRef = doc(db, "mentors", newMentor.id);
                     await updateDoc(newMRef, { assignedStudents: arrayUnion(s.id) });
                     
                     alerts.push(`Auto-reassigned ${s.name} from ${mentors.find(m => m.id === oldMentorId)?.name || 'None'} to ${newMentor.name} due to stagnant progress metrics.`);
                 }
              }
           }
        }
        if (alerts.length > 0) setReassignmentAlerts(alerts);
     };
     
     // Only run this check once initially or upon core data hydration
     const timer = setTimeout(() => { checkReassignments(); }, 3000);
     return () => clearTimeout(timer);
  }, []);

  const atRiskStudents = mappedStudents.filter(s => s.stats?.progress?.missedSessions >= 2 || s.stats?.progress?.streak === 0);

  // Compute Subject Weakness Summary
  const weakSummary = {};
  mappedStudents.forEach(s => {
    if (s.stats?.weakSubjects) {
      s.stats.weakSubjects.forEach(sub => {
        weakSummary[sub] = (weakSummary[sub] || 0) + 1;
      });
    }
  });
  const weakData = Object.entries(weakSummary).sort((a, b) => b[1] - a[1]);
  const maxWeakCount = weakData.length > 0 ? weakData[0][1] : 1;

  // Smart Panel Metrics
  const inactiveMentors = mentors.filter(m => (m.assignedStudents?.length || 0) === 0 || m.completedSessions === 0);
  const lowPerformanceMentors = mentors.filter(m => (m.performanceScore || 0) < 50 && m.totalSessions > 0);
  
  const sortedMentors = [...mentors].sort((a, b) => (b.performanceScore || 0) - (a.performanceScore || 0));

  // Compute Platform Impact Metrics
  const totalStudyMins = mappedStudents.reduce((acc, s) => acc + (s.stats?.progress?.studyTime?.weekly || 0), 0);
  const totalStudyHours = Math.round((totalStudyMins / 60) * 10) / 10;
  
  const activeMatches = mappedStudents.filter(s => s.stats?.assignedMentorId).length;
  const matchRate = students.length > 0 ? Math.round((activeMatches / students.length) * 100) : 0;

  // Impact Report Math (Step 6)
  let validStudentsForImpact = 0;
  let totalInitial = 0;
  let totalCurrent = 0;
  mappedStudents.forEach(s => {
    const qs = s.stats?.progress?.quizScores || [];
    if (qs.length >= 2) {
       validStudentsForImpact++;
       totalInitial += qs[0];
       totalCurrent += qs[qs.length - 1];
    }
  });

  const avgInitialScore = validStudentsForImpact ? Math.round(totalInitial / validStudentsForImpact) : 0;
  const avgCurrentScore = validStudentsForImpact ? Math.round(totalCurrent / validStudentsForImpact) : 0;
  const avgImprovement = avgCurrentScore - avgInitialScore;

  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <header className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', borderRadius: 0, padding: '1rem 2rem' }}>
        <div className="flex-center gap-2 text-gradient">
          <BookOpen size={28} color="var(--secondary)" />
          <h2>EduBridge NGO Portal</h2>
        </div>
        <div className="flex-center gap-4">
          <span className="tag warning">System Admin</span>
          <span style={{ fontWeight: 600 }}>{currentUser?.displayName || 'Admin'}</span>
          <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="main-content animate-fade-in" style={{ padding: '2rem' }}>
        
        <div className="glass-card hover-scale" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, var(--secondary) 0%, #059669 100%)', color: 'white', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
          
          {/* Subtle background innovation */}
          <div style={{ position: 'absolute', right: '-10%', top: '-50%', width: '300px', height: '300px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(40px)' }}></div>
          
          <div className="flex-between" style={{ position: 'relative', zIndex: 1, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ color: 'white', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BookOpen size={24}/> NGO Operations Command
              </h2>
              <p style={{ color: '#D1FAE5', opacity: 0.9, maxWidth: '400px', margin: 0, lineHeight: 1.5 }}>
                Real-time tracking of platform impact, mentorship pairings, and high-level student intervention health.
              </p>
              
              <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#D1FAE5', textTransform: 'uppercase', letterSpacing: '1px' }}>Global Learn Hours</p>
                  <strong style={{ fontSize: '1.5rem', color: 'white', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    {totalStudyHours} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>hrs</span>
                  </strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#D1FAE5', textTransform: 'uppercase', letterSpacing: '1px' }}>System Health</p>
                  <strong style={{ fontSize: '1.5rem', color: 'white', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                    {matchRate}% <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>Matched</span>
                  </strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}>
                   <p style={{ margin: 0, fontSize: '0.85rem', color: '#D1FAE5', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Impact (Avg)</p>
                   <strong style={{ fontSize: '1.5rem', color: avgImprovement > 0 ? '#6EE7B7' : avgImprovement < 0 ? '#FCA5A5' : 'white', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                     {avgImprovement > 0 ? '+' : ''}{avgImprovement}% {avgImprovement > 0 ? '📈' : avgImprovement < 0 ? '📉' : ''} <span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'white' }}>({avgInitialScore}% → {avgCurrentScore}%)</span>
                   </strong>
                </div>
              </div>
            </div>

            <div className="flex-center gap-4" style={{ textAlign: 'center', background: 'rgba(0,0,0,0.15)', padding: '1.5rem', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
              <div>
                <h1 style={{ color: 'white', margin: 0, fontSize: '2.5rem' }}>{students.length}</h1>
                <p style={{ color: '#D1FAE5', fontSize: '0.9rem', margin: '0.25rem 0 0 0', fontWeight: 500 }}>Students Enrolled</p>
              </div>
              <div style={{ width: '1px', height: '60px', background: 'rgba(255,255,255,0.2)' }}></div>
              <div>
                <h1 style={{ color: 'white', margin: 0, fontSize: '2.5rem' }}>{mentors.length}</h1>
                <p style={{ color: '#D1FAE5', fontSize: '0.9rem', margin: '0.25rem 0 0 0', fontWeight: 500 }}>Active Educators</p>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Alert Panel */}
        <div className="grid-3" style={{ marginBottom: '2rem', gap: '1.5rem', alignItems: 'stretch' }}>
          <div className="glass-card flex-between hover-scale" style={{ padding: '1.5rem', borderLeft: '4px solid var(--danger)', alignItems: 'flex-start' }}>
             <div style={{ flex: 1 }}>
               <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Students At Risk</p>
               <h2 style={{ margin: '0.25rem 0 0 0', color: 'var(--danger)' }}>{atRiskStudents.length}</h2>
             </div>
             <AlertTriangle size={32} color="var(--danger)" opacity={0.8} style={{ flexShrink: 0 }} />
          </div>
          <div className="glass-card flex-between hover-scale" style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)', alignItems: 'flex-start' }}>
             <div style={{ flex: 1 }}>
               <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Inactive Mentors</p>
               <h2 style={{ margin: '0.25rem 0 0 0', color: 'var(--warning)' }}>{inactiveMentors.length}</h2>
               {inactiveMentors.length > 0 && (
                   <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                     {inactiveMentors.map(m => m.name).join(', ')}
                   </p>
               )}
             </div>
             <Users size={32} color="var(--warning)" opacity={0.8} style={{ flexShrink: 0 }} />
          </div>
          <div className="glass-card flex-between hover-scale" style={{ padding: '1.5rem', borderLeft: '4px solid #9333ea', alignItems: 'flex-start' }}>
             <div style={{ flex: 1 }}>
               <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Low Performance Mentors</p>
               <h2 style={{ margin: '0.25rem 0 0 0', color: '#9333ea' }}>{lowPerformanceMentors.length}</h2>
               {lowPerformanceMentors.length > 0 && (
                   <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                     {lowPerformanceMentors.map(m => m.name).join(', ')}
                   </p>
               )}
             </div>
             <AlertCircle size={32} color="#9333ea" opacity={0.8} style={{ flexShrink: 0 }} />
          </div>
        </div>

        <div className="grid-2" style={{ gap: '2rem', marginBottom: '2rem' }}>
          {atRiskStudents.length === 0 ? (
            <div className="glass-card flex-center" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
               <h3 style={{ color: '#065F46', margin: 0 }}>All systems running smoothly ✅</h3>
            </div>
          ) : (
            <div className="glass-card" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
              <div className="flex-between" style={{ borderBottom: '1px solid #FCA5A5', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h3 className="flex-center gap-2" style={{ color: 'var(--danger)', margin: 0 }}><AlertTriangle size={20}/> Risk Assessment List</h3>
                <span className="tag danger">{atRiskStudents.length} Students</span>
              </div>
              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                {atRiskStudents.map(s => (
                  <div key={s.id} className="flex-between" style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #FCA5A5', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div>
                      <h4 style={{ margin: 0, color: 'var(--text-main)' }}>{s.name}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>Mentor: {mentors.find(m => m.id === s.stats?.assignedMentorId)?.name || 'None'}</p>
                    </div>
                    <div className="flex-center gap-2">
                      <span className="tag" style={{ background: '#FEE2E2', color: '#991B1B' }}>{s.stats?.progress?.missedSessions || 0} Missed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subject Demand Analytics Chart */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 className="flex-center gap-2" style={{ margin: '0 0 1.5rem 0' }}><BookOpen size={20} color="var(--primary)"/> Subject Demand Analytics</h3>
            {weakData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
                {weakData.slice(0, 5).map(([subject, count]) => (
                  <div key={subject} title={`${subject} → ${count} students weak`}>
                     <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                        <span>{subject}</span>
                        <span>{count} Students</span>
                     </div>
                     <div style={{ width: '100%', height: '8px', background: 'var(--surface)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxWeakCount) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)', borderRadius: '4px' }}></div>
                     </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-center" style={{ flex: 1, color: 'var(--text-muted)' }}>No demand data available yet.</div>
            )}
          </div>
        </div>

        {reassignmentAlerts.length > 0 && (
          <div className="glass-card animate-fade-in" style={{ background: '#FFF7ED', border: '1px solid #FDBA74', marginBottom: '2rem' }}>
             <h3 style={{ color: '#C2410C', margin: '0 0 1rem 0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><AlertTriangle size={20}/> Automatic Reassignments Executed</h3>
             <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#9A3412', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {reassignmentAlerts.map((alert, idx) => <li key={idx}><strong>{alert}</strong></li>)}
             </ul>
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: '2rem' }}>
          {/* Mentor Management & Performance Table */}
          <div className="glass-card" style={{ overflowX: 'auto', gridColumn: '1 / -1' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
               <h3 className="flex-center gap-2" style={{ margin: 0 }}><Users size={20} color="var(--primary)"/> Educator Management</h3>
               <button className="btn btn-primary" onClick={() => setShowAddMentor(!showAddMentor)}>+ Add New Mentor</button>
            </div>
            {showAddMentor && (
               <div className="animate-fade-in" style={{ background: '#F9FAFB', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0' }}>Authorize Mentor Signup</h4>
                  <form onSubmit={handleAddMentor} className="grid-2" style={{ gap: '1rem', alignItems: 'end' }}>
                     <div>
                       <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mentor Name</label>
                       <input type="text" className="form-input" style={{ width: '100%', marginTop: '0.25rem' }} value={mentorForm.name} onChange={e => setMentorForm({...mentorForm, name: e.target.value})} required />
                     </div>
                     <div>
                       <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Email Address</label>
                       <input type="email" className="form-input" style={{ width: '100%', marginTop: '0.25rem' }} value={mentorForm.email} onChange={e => setMentorForm({...mentorForm, email: e.target.value})} required />
                     </div>
                     <div style={{ gridColumn: '1 / -1' }}>
                       <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Expertise Subjects (Comma Separated)</label>
                       <div style={{ display: 'flex', gap: '1rem' }}>
                         <input type="text" className="form-input" style={{ flex: 1, marginTop: '0.25rem' }} placeholder="e.g. Science, Math" value={mentorForm.subjects} onChange={e => setMentorForm({...mentorForm, subjects: e.target.value})} required />
                         <button type="submit" className="btn btn-secondary" style={{ marginTop: '0.25rem' }}>Send Authorization Link</button>
                       </div>
                     </div>
                  </form>
               </div>
            )}
            
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ paddingBottom: '0.75rem' }}>Mentor Name</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Status</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Assigned Students</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Sessions Completed</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Performance Score</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingMentors.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', background: '#FEF3C7' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{m.name} <br/><span style={{fontSize:'0.75rem', color: '#B45309'}}>{m.email}</span></td>
                    <td style={{ padding: '0.75rem 0.5rem' }}><span className="tag" style={{ background: '#FDE68A', color: '#92400E' }}>Pending Reg.</span></td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>-</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>-</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>-</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <button className="btn btn-sm" style={{ background: '#FEE2E2', color: '#991B1B' }} onClick={() => removePendingMentor(m.id)}>Revoke Auth</button>
                    </td>
                  </tr>
                ))}
                {mentors.map(m => {
                  const mStudents = mappedStudents.filter(st => st.stats?.assignedMentorId === m.id);
                  const mAtRisk = mStudents.filter(st => st.stats?.progress?.missedSessions >= 2 || st.stats?.progress?.streak === 0).length;
                  return (
                  <tr key={m.id} className="hover-scale" style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{m.name} <br/><span style={{fontSize:'0.75rem', color: 'var(--text-muted)'}}>{m.email}</span></td>
                    <td style={{ padding: '0.75rem 0.5rem' }}><span className="tag success">Active</span></td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                       {(m.assignedStudents?.length || 0) === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No students assigned</span> : `Students: ${m.assignedStudents.length}`}
                       {mAtRisk > 0 && <><br/><span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>At Risk: {mAtRisk}</span></>}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{m.completedSessions || 0}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: m.performanceScore > 75 ? 'var(--success)' : 'var(--text-main)', fontWeight: 600 }}>{Math.round(m.performanceScore || 0)}%</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <button className="btn btn-sm btn-danger" onClick={() => removeActiveMentor(m.id)}>Deactivate</button>
                    </td>
                  </tr>
                )})}
                {mentors.length === 0 && pendingMentors.length === 0 && <tr><td colSpan="6" style={{ padding: '1rem', textAlign: 'center' }}>No mentors added yet</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Student Progress Monitoring */}
          <div className="glass-card" style={{ overflowX: 'auto', gridColumn: '1 / -1', marginTop: '1rem' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
               <h3 className="flex-center gap-2" style={{ margin: 0 }}><BookOpen size={20} color="var(--secondary)"/> Systematic Student Monitoring</h3>
               <button className="btn btn-secondary btn-sm" onClick={handleGlobalMatch} disabled={isMatching}>
                 {isMatching ? 'Matching...' : '🧠 Run Global AI Match'}
               </button>
            </div>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ paddingBottom: '0.75rem' }}>Student Name</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Assigned Mentor</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Quiz Avg Score</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Streak</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Assignment Progress</th>
                  <th style={{ paddingBottom: '0.75rem' }}>Risk Status</th>
                </tr>
              </thead>
              <tbody>
                {mappedStudents.map(s => {
                   const qs = s.stats?.progress?.quizScores || [];
                   const avgQuiz = qs.length ? Math.round(qs.reduce((a,b)=>a+b,0) / qs.length) : 'N/A';
                   const hasRisk = s.stats?.progress?.missedSessions >= 2 || s.stats?.progress?.streak === 0;
                   return (
                     <tr key={s.id} className="hover-scale" style={{ borderBottom: '1px solid var(--border)' }}>
                       <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                          {s.name}
                          {s.stats?.reassignmentReason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px' }}>
                              Reason: {s.stats.reassignmentReason}
                            </div>
                          )}
                          {s.stats?.matchingReason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '2px' }}>
                              Matched based on: {s.stats.matchingReason.map(str => str.charAt(0).toUpperCase() + str.slice(1)).join(' + ')}
                            </div>
                          )}
                       </td>
                       <td style={{ padding: '0.75rem 0.5rem' }}>{mentors.find(m => m.id === s.stats?.assignedMentorId)?.name || 'Needs Match'}</td>
                       <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{avgQuiz}{avgQuiz !== 'N/A' && '%'}</td>
                       <td style={{ padding: '0.75rem 0.5rem' }}>🔥 {s.stats?.progress?.streak || 0}</td>
                       <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                          {(() => {
                             const path = s.stats?.progress?.learningPath || [];
                             const completed = path.filter(p => p.status === 'completed').length;
                             const total = path.length || 1;
                             return Math.round((completed / total) * 100) + '%';
                          })()}
                       </td>
                       <td style={{ padding: '0.75rem 0.5rem' }}>
                          {hasRisk ? <span className="tag danger">At Risk</span> : <span className="tag success">Healthy</span>}
                       </td>
                     </tr>
                   )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mentor Ranking Table */}
        <div className="glass-card" style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <h3 className="flex-center gap-2" style={{ marginBottom: '1.5rem', justifyContent: 'flex-start' }}><Award size={20} color="var(--accent)"/> Mentor Performance Rankings</h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ paddingBottom: '0.75rem' }}>Rank</th>
                <th style={{ paddingBottom: '0.75rem' }}>Mentor Name</th>
                <th style={{ paddingBottom: '0.75rem' }}>Assigned Students</th>
                <th style={{ paddingBottom: '0.75rem' }}>Sessions Completed</th>
                <th style={{ paddingBottom: '0.75rem' }}>Performance Score</th>
              </tr>
            </thead>
            <tbody>
              {sortedMentors.map((m, idx) => {
                let badge = '';
                let highlight = 'transparent';
                if(idx === 0) { badge = '🥇 '; highlight = 'linear-gradient(90deg, #FEF3C7 0%, transparent 100%)'; }
                if(idx === 1) { badge = '🥈 '; highlight = 'linear-gradient(90deg, #F3F4F6 0%, transparent 100%)'; }
                if(idx === 2) { badge = '🥉 '; highlight = 'linear-gradient(90deg, #FFEDD5 0%, transparent 100%)'; }
                
                const mStudents = mappedStudents.filter(st => st.stats?.assignedMentorId === m.id);
                const mAtRisk = mStudents.filter(st => st.stats?.progress?.missedSessions >= 2 || st.stats?.progress?.streak === 0).length;
                
                return (
                <tr key={m.id} className="hover-scale" style={{ borderBottom: '1px solid var(--border)', background: highlight }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: idx < 3 ? 'var(--accent)' : 'var(--text-main)' }}>{badge}#{idx + 1}</td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{m.name}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                     {(m.assignedStudents?.length || 0) === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No students assigned</span> : `Students: ${m.assignedStudents.length}`}
                     {mAtRisk > 0 && <><br/><span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>At Risk: {mAtRisk}</span></>}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{m.completedSessions || 0}</td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: (m.performanceScore || 0) > 75 ? 'var(--success)' : (m.performanceScore || 0) < 50 ? 'var(--danger)' : 'var(--text-main)' }}>
                     {Math.round(m.performanceScore || 0)}%
                  </td>
                </tr>
              )})}
              {sortedMentors.length === 0 && <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>No mentors added yet</td></tr>}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
};

export default NGODashboard;
