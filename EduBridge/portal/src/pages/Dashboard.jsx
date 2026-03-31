import React, { useState } from 'react';
import { usePortal } from '../context/PortalContext';
import StudentCard from '../components/StudentCard';
import SessionCard from '../components/SessionCard';
import { TrendingUp, Users, CalendarCheck, AlertCircle, Signal, Flame, MessageCircle, FileWarning } from 'lucide-react';

const Dashboard = () => {
  const { mentor, students, sessions, createAssignment, assignments = [], doubts = [], answerDoubt } = usePortal();

  const [filterRisk, setFilterRisk] = useState('All'); // All, Active, At Risk
  const [sortParam, setSortParam] = useState('Default'); // Default, Streak, Activity
  
  const [replyDoubtId, setReplyDoubtId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittedMsgId, setSubmittedMsgId] = useState(null);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ title: '', description: '', studentId: '', dueDate: '' });

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if(!assignForm.studentId || !assignForm.title) return;
    const studentName = students.find(s => s.id === assignForm.studentId)?.name || 'Student';
    const subject = mentor.subjects.length > 0 ? mentor.subjects[0] : 'General';
    await createAssignment({ 
       title: assignForm.title,
       description: assignForm.description,
       studentId: assignForm.studentId,
       studentName,
       dueDate: assignForm.dueDate,
       subject 
    });
    setAssignForm({ title: '', description: '', studentId: '', dueDate: '' });
    setShowAssignForm(false);
  };

  const handleReplyDoubt = async (doubtId) => {
     if (!replyText.trim()) return;
     try {
         await answerDoubt(doubtId, replyText);
         setSubmittedMsgId(doubtId);
         setTimeout(() => {
             setSubmittedMsgId(null);
             setReplyDoubtId(null);
             setReplyText('');
         }, 2000);
     } catch (err) {
         console.error("Error answering doubt:", err);
         alert(`Error: ${err.message}\n\nPlease hit 'Refresh' or 'F5' on your browser to sync the latest AI Context!`);
     }
  };

  const pendingAsg = assignments.filter(a => a.status === 'pending');
  const completedAsg = assignments.filter(a => a.status === 'completed');

  // Metrics Logic
  const activeStudentsCount = students.filter(s => {
    const weeklyCount = s.activityLog?.slice(-7).filter(x => x > 0).length || 0;
    return weeklyCount >= 3;
  }).length;
  
  const atRiskStudents = students.filter(s => {
    const weeklyCount = s.activityLog?.slice(-7).filter(x => x > 0).length || 0;
    return s.streak === 0 || s.missedSessions >= 2 || weeklyCount === 0 || s.aiAlert;
  });

  const avgStreak = students.length ? Math.round(students.reduce((acc, s) => acc + (s.streak || 0), 0) / students.length) : 0;

  // Filter & Sort Application
  let assignedStudents = [...students];
  
  if (filterRisk === 'Active') {
    assignedStudents = assignedStudents.filter(s => {
       const weeklyCount = s.activityLog?.slice(-7).filter(x => x > 0).length || 0;
       return weeklyCount >= 3 && s.streak > 0;
    });
  } else if (filterRisk === 'At Risk') {
    assignedStudents = assignedStudents.filter(s => {
       const weeklyCount = s.activityLog?.slice(-7).filter(x => x > 0).length || 0;
       return s.streak === 0 || s.missedSessions >= 2 || weeklyCount === 0;
    });
  }

  if (sortParam === 'Streak') {
    assignedStudents.sort((a,b) => (b.streak || 0) - (a.streak || 0));
  } else if (sortParam === 'Activity') {
    assignedStudents.sort((a,b) => {
       const wA = a.activityLog?.slice(-7).filter(x => x > 0).length || 0;
       const wB = b.activityLog?.slice(-7).filter(x => x > 0).length || 0;
       return wB - wA;
    });
  }

  const upcomingSessions = sessions.filter(s => s.status === 'scheduled');
  const rescheduleRequests = sessions.filter(s => s.status === 'reschedule_requested');

  const pendingReports = upcomingSessions.filter(s => {
     if (!s.date || !s.time) return false;
     const dt = new Date(s.date + 'T' + s.time);
     return dt < new Date();
  });
  
  const unresolvedDoubts = doubts.filter(d => d.status === 'open' || d.id === submittedMsgId);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <header>
        <h1 className="text-gradient">Welcome back, {mentor.name}</h1>
        <p>Here is your performance overview and schedule for today.</p>
      </header>

      {/* Student Insights Panel */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-card flex-between" style={{ padding: '1.2rem', borderBottom: '3px solid var(--primary)' }}>
          <div>
             <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Students</p>
             <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{students.length}</h2>
          </div>
          <Users size={28} color="var(--primary)" />
        </div>
        
        <div className="glass-card flex-between" style={{ padding: '1.2rem', borderBottom: '3px solid #10B981' }}>
          <div>
             <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Engagement</p>
             <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{activeStudentsCount}</h2>
          </div>
          <Signal size={28} color="#10B981" />
        </div>

        <div className="glass-card flex-between" style={{ padding: '1.2rem', borderBottom: '3px solid var(--danger)' }}>
          <div>
             <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Needs Attention</p>
             <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{atRiskStudents.length}</h2>
          </div>
          <AlertCircle size={28} color="var(--danger)" />
        </div>

        <div className="glass-card flex-between" style={{ padding: '1.2rem', borderBottom: '3px solid var(--accent)' }}>
          <div>
             <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Average Streak</p>
             <h2 style={{ fontSize: '1.8rem', margin: 0 }}>{avgStreak} <span style={{ fontSize: '1rem' }}>Days</span></h2>
          </div>
          <Flame size={28} color="var(--accent)" />
        </div>
      </section>

      {/* Performance Metrics */}
      <section className="grid-3" style={{ gap: '1.5rem' }}>
        <div className="glass-card flex-center" style={{ flexDirection: 'column', padding: '2rem 1rem' }}>
          <div style={{ background: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <CalendarCheck size={32} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>{mentor.performance.totalSessions}</h2>
          <p>Total Sessions Delivered</p>
        </div>

        <div className="glass-card flex-center" style={{ flexDirection: 'column', padding: '2rem 1rem' }}>
          <div style={{ background: 'var(--secondary)', color: 'white', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Users size={32} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>{mentor.performance.attendance}%</h2>
          <p>Student Attendance Rate</p>
        </div>

        <div className="glass-card flex-center" style={{ flexDirection: 'column', padding: '2rem 1rem' }}>
          <div style={{ background: 'var(--accent)', color: 'white', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <TrendingUp size={32} />
          </div>
          <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--secondary)' }}>{mentor.performance.studentImprovementTrend}</h2>
          <p>Avg Student Improvement</p>
        </div>
      </section>

      <div className="grid-2" style={{ gap: '2.5rem' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <div className="flex-between">
              <h2 style={{ margin: 0 }}>My Students</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select className="form-select" style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }} value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                   <option value="All">All Status</option>
                   <option value="Active">Active Only</option>
                   <option value="At Risk">At Risk</option>
                </select>
                <select className="form-select" style={{ padding: '0.4rem', fontSize: '0.85rem', width: 'auto' }} value={sortParam} onChange={e => setSortParam(e.target.value)}>
                   <option value="Default">Default Sort</option>
                   <option value="Streak">Top Streak</option>
                   <option value="Activity">Highest Activity</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {assignedStudents.map(student => (
                <StudentCard key={student.id} student={student} />
              ))}
            </div>
          </section>

          {/* Assignments Section */}
          <section>
            <div className="flex-between">
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 Tasks & Assignments
              </h2>
              <button className="btn btn-primary btn-sm hover-scale" onClick={() => setShowAssignForm(!showAssignForm)}>
                {showAssignForm ? 'Cancel' : '+ Create Assignment'}
              </button>
            </div>

            {showAssignForm && (
              <form onSubmit={handleCreateAssignment} className="glass-card animate-fade-in" style={{ marginTop: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Assignment Title</label>
                    <input type="text" className="form-input" required value={assignForm.title} onChange={e => setAssignForm({...assignForm, title: e.target.value})} placeholder="e.g. Algebra Worksheet" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Assign To</label>
                    <select className="form-select" required value={assignForm.studentId} onChange={e => setAssignForm({...assignForm, studentId: e.target.value})}>
                      <option value="">-- Choose Student --</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.class})</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Description / Instructions</label>
                    <textarea className="form-input" required value={assignForm.description} onChange={e => setAssignForm({...assignForm, description: e.target.value})} placeholder="Solve exercises 1 to 10..." rows="2" style={{ resize: 'none' }}></textarea>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-input" required value={assignForm.dueDate} onChange={e => setAssignForm({...assignForm, dueDate: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="btn btn-secondary">Assign Task</button>
              </form>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-muted)' }}>Recent Submissions</h3>
              {completedAsg.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>No completed assignments recently.</p>
              ) : (
                completedAsg.slice(0, 5).map(a => (
                  <div key={a.id} className="flex-between glass-card hover-scale" style={{ padding: '1rem', border: '1px solid var(--border)' }}>
                     <div>
                       <div className="flex-center gap-2">
                         <span className="tag success">Completed</span>
                         <span style={{ fontWeight: 600 }}>{a.studentName}</span>
                       </div>
                       <h4 style={{ margin: '0.5rem 0 0 0', color: 'var(--text-main)' }}>{a.title}</h4>
                     </div>
                     <span style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 'bold' }}>+{a.score} Pts Awarded</span>
                  </div>
                ))
              )}

              <h3 style={{ fontSize: '1rem', margin: '1rem 0 0 0', color: 'var(--text-muted)' }}>Pending Tasks ({pendingAsg.length})</h3>
              {pendingAsg.slice(0, 3).map(a => (
                <div key={a.id} className="flex-between glass-card hover-scale" style={{ padding: '0.75rem 1rem', background: '#F9FAFB' }}>
                   <div>
                     <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.studentName}</span>
                     <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{a.title}</p>
                   </div>
                   <span style={{ fontSize: '0.8rem', color: '#B45309' }}>Due: {a.dueDate}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {atRiskStudents.length > 0 && (
            <section>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                <AlertCircle size={24} /> Risk Alerts
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {atRiskStudents.map(student => (
                  <div key={student.id} className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '1rem' }}>
                    <div className="flex-between">
                      <h4 style={{ margin: 0, fontWeight: 600 }}>{student.name} ({student.class})</h4>
                      <span className="tag" style={{ background: '#FEE2E2', color: '#991B1B' }}>Risk Alert</span>
                    </div>
                    {student.aiAlert && (
                       <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#7F1D1D', fontWeight: 600, background: '#FEF2F2', padding: '0.5rem', borderRadius: '4px' }}>{student.aiAlert}</p>
                    )}
                    {student.missedSessions >= 2 && (
                       <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>Student has missed {student.missedSessions} sessions. Please reach out or coordinate an intervention.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {rescheduleRequests.length > 0 && (
            <section>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                <AlertCircle size={24} /> Action Required
              </h2>
              {rescheduleRequests.map(req => {
                const sName = students.find(s => s.id === req.student_id)?.name;
                return <SessionCard key={req.id} session={req} studentName={sName} />;
              })}
            </section>
          )}

          <section>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
               <CalendarCheck size={24} color="var(--primary)" /> Daily Task Panel
            </h2>
            
            {unresolvedDoubts.length > 0 ? (
               <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}><MessageCircle size={18} /> Student Doubts ({unresolvedDoubts.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                     {unresolvedDoubts.slice(0, 3).map(d => {
                        const sName = students.find(s => s.id === d.student_id)?.name;
                        return (
                           <div key={d.id} className="glass-card" style={{ padding: '0.75rem', borderLeft: '3px solid var(--accent)' }}>
                               <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sName} asks:</span>
                               <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>"{d.text}"</p>
                               
                               {submittedMsgId === d.id ? (
                                   <div className="animate-fade-in" style={{ marginTop: '0.75rem', color: '#10B981', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      ✅ Submitted successfully! 
                                   </div>
                               ) : replyDoubtId === d.id ? (
                                   <div className="animate-fade-in" style={{ marginTop: '0.75rem' }}>
                                       <textarea className="form-input" rows="2" placeholder="Write your exact answer here..." value={replyText} onChange={e => setReplyText(e.target.value)} style={{ padding: '0.5rem', width: '100%', fontSize: '0.85rem' }}></textarea>
                                       <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                                          <button className="btn" style={{ background: '#F3F4F6', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => setReplyDoubtId(null)}>Cancel</button>
                                          <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={() => handleReplyDoubt(d.id)}>Submit Answer</button>
                                       </div>
                                   </div>
                               ) : (
                                   <button className="btn btn-secondary hover-scale" style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.2rem 0.6rem' }} onClick={() => setReplyDoubtId(d.id)}>Quick Reply</button>
                               )}
                           </div>
                        )
                     })}
                  </div>
               </div>
            ) : (
               <div className="glass-card flex-center" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}>
                  <span style={{ fontWeight: 500 }}>No doubts today 🎉</span>
               </div>
            )}

            {pendingReports.length > 0 && (
               <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}><FileWarning size={18} /> Pending Reports ({pendingReports.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                     {pendingReports.slice(0, 3).map(s => {
                        const sName = students.find(st => st.id === s.student_id)?.name;
                        return (
                           <div key={s.id} className="glass-card" style={{ padding: '0.75rem', borderLeft: '3px solid var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <div>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sName}</span>
                                  <p style={{ margin: '0 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Session from {new Date(s.date).toLocaleDateString()}</p>
                               </div>
                               <span className="tag" style={{ background: '#FEE2E2', color: 'var(--danger)' }}>Needs Report</span>
                           </div>
                        )
                     })}
                  </div>
               </div>
            )}

            <h3 style={{ fontSize: '1rem', marginTop: '1rem' }}>Upcoming Sessions</h3>
            {upcomingSessions.length > 0 ? (
              upcomingSessions.map(session => {
                const sName = students.find(s => s.id === session.student_id)?.name;
                return <SessionCard key={session.id} session={session} studentName={sName} />;
              })
            ) : (
              <div className="glass-card flex-center" style={{ minHeight: '100px' }}>
                <p>No sessions scheduled</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
