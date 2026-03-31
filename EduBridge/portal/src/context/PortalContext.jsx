import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, addDoc, orderBy, limit } from 'firebase/firestore';

const PortalContext = createContext();

export const usePortal = () => useContext(PortalContext);

export const PortalProvider = ({ children }) => {
  const { currentUser, userRole } = useAuth();
  
  // States mapped to original mockData format
  const [mentor, setMentor] = useState({
    id: "", name: "Loading...", subjects: [], ageGroup: "", qualifications: "",
    performance: { totalSessions: 0, attendance: 100, studentImprovementTrend: "N/A" }
  });
  
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [availability, setAvailability] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [dailyLogs, setDailyLogs] = useState([]);
  const [doubts, setDoubts] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (!currentUser || userRole !== 'Mentor') return;

    // 1. Listen to Mentor Profile
    const unsubMentor = onSnapshot(doc(db, "mentors", currentUser.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Let's get the user name too
        const uSnap = await getDoc(doc(db, "users", currentUser.uid));
        const uData = uSnap.exists() ? uSnap.data() : { name: "Unknown" };

        setMentor({
          id: currentUser.uid,
          name: uData.name,
          subjects: data.expertise || [],
          ageGroup: data.ageGroup || "High School",
          qualifications: data.bio || "EduBridge Mentor",
          performance: { totalSessions: 0, attendance: 100, studentImprovementTrend: "Good" }
        });

        // Set availability matrix mapping
        const availMap = {};
        if (data.availability) {
          data.availability.forEach(a => {
            if (!availMap[a.date]) availMap[a.date] = [];
            availMap[a.date].push(a.time);
          });
        }
        setAvailability(availMap);
      }
    });

    // 2. Listen to Students Assigned to this Mentor
    const qStudents = query(collection(db, "students"), where("assignedMentorId", "==", currentUser.uid));
    const unsubStudents = onSnapshot(qStudents, async (snapshot) => {
      const studentPromises = snapshot.docs.map(async (docSnap) => {
        const sData = docSnap.data();
        const uSnap = await getDoc(doc(db, "users", docSnap.id));
        const uData = uSnap.exists() ? uSnap.data() : { name: "Unknown Student" };

        return {
          id: docSnap.id,
          name: uData.name,
          class: uData.class || "Not Specified",
          weak_subjects: sData.weakSubjects || [],
          quizScores: sData.progress?.quizScores || [],
          badges: sData.progress?.badges || [],
          points: sData.progress?.points || 0,
          missedSessions: sData.progress?.missedSessions || 0,
          overall_performance: sData.progress?.overall_performance || "New student.",
          streak: sData.progress?.streak || 0,
          activityLog: sData.progress?.activityLog || Array.from({ length: 14 }, () => 0),
          lastActiveDate: sData.progress?.lastActiveDate || "Never"
        };
      });

      const resolvedStudents = await Promise.all(studentPromises);
      setStudents(resolvedStudents);
    });

    // 3. Listen to Sessions
    const qSessions = query(collection(db, "sessions"), where("mentor_id", "==", currentUser.uid));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      const loadedSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSessions(loadedSessions);
    });

    // 4. Listen to Global Leaderboard
    const qLeaderboard = query(collection(db, "leaderboard"), orderBy("points", "desc"), limit(10));
    const unsubLeaderboard = onSnapshot(qLeaderboard, (snapshot) => {
      setLeaderboard(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 5. Listen to Assignments for Mentor
    const qAssignments = query(collection(db, "assignments"), where("mentorId", "==", currentUser.uid));
    const unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
      const asgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      asgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAssignments(asgs);
    });

    // 6. Listen to Daily Logs for Mentor
    const qLogs = query(collection(db, "dailyLogs"), where("mentorId", "==", currentUser.uid));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setDailyLogs(logs);
    });

    // 7. Listen to Doubts for Mentor
    const qDoubts = query(collection(db, "doubts"), where("mentor_id", "==", currentUser.uid));
    const unsubDoubts = onSnapshot(qDoubts, (snapshot) => {
      const dbts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      dbts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setDoubts(dbts);
    });

    return () => {
      unsubMentor();
      unsubStudents();
      unsubSessions();
      unsubLeaderboard();
      unsubAssignments();
      unsubLogs();
      unsubDoubts();
    };
  }, [currentUser, userRole]);


  // Actions mapping straight to Firestore
  
  const updateMentorProfile = async (updatedData) => {
    if (!currentUser) return;
    const mentorRef = doc(db, "mentors", currentUser.uid);
    // Format back the data for persistence
    await updateDoc(mentorRef, {
      bio: updatedData.qualifications || mentor.qualifications,
      expertise: updatedData.subjects || mentor.subjects
    });
  };

  const addAvailability = async (date, slot) => {
    if (!currentUser) return;
    const mentorRef = doc(db, "mentors", currentUser.uid);
    const mSnap = await getDoc(mentorRef);
    if (!mSnap.exists()) return;
    
    const existingAvail = mSnap.data().availability || [];
    // Only add if not exists
    if (!existingAvail.some(a => a.date === date && a.time === slot)) {
      await updateDoc(mentorRef, {
        availability: [...existingAvail, { date, time: slot }]
      });
    }
  };

  const bookSession = async (bookingData) => {
    if (!currentUser) return;
    
    const targetStudent = bookingData.studentId || bookingData.student_id;
    
    // Explicit global conflict blocking
    const snap = await getDocs(collection(db, "sessions"));
    const isDuplicate = snap.docs.some(doc => {
       const d = doc.data();
       const sId = d.studentId || d.student_id;
       return sId === targetStudent && d.date === bookingData.date && d.time === bookingData.time;
    });

    if (isDuplicate) {
      throw new Error("Student already has a session at this time");
    }

    await addDoc(collection(db, "sessions"), {
      mentorId: currentUser.uid,
      studentId: targetStudent,
      subject: mentor?.subjects?.[0] || 'General',
      status: 'scheduled',
      ...bookingData
    });
  };

  const submitSessionReport = async (sessionId, studentId, reportText) => {
    if (!currentUser) return;
    
    // 1. Update session document
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, { status: "completed", report: reportText });
    
    // 2. Add to student's reports collection
    const reportVal = {
       date: new Date().toISOString(),
       mentorId: currentUser.uid,
       report: reportText
    };
    await addDoc(collection(db, `students/${studentId}/reports`), reportVal);
    
    // 3. Update student.overallPerformance
    const stRef = doc(db, "students", studentId);
    const stSnap = await getDoc(stRef);
    if (stSnap.exists()) {
       const existingPerf = stSnap.data().progress?.overall_performance || "";
       await updateDoc(stRef, { "progress.overall_performance": existingPerf + ` | Mentor Note: ${reportText}` });
    }
    
    // 4. Update Mentor Performance Tracking
    const mRef = doc(db, "mentors", currentUser.uid);
    const mSnap = await getDoc(mRef);
    if (mSnap.exists()) {
       const mData = mSnap.data();
       const totalSessions = (mData.totalSessions || 0) + 1; // Assuming total Sessions historically matches scheduled
       const completedSessions = (mData.completedSessions || 0) + 1;
       const reportsSubmitted = (mData.reportsSubmitted || 0) + 1;
       
       // Hardcoded positive improvement curve for logic mockup since students scores may vary
       const studentImprovement = 85; 
       
       const sessionCompletionRate = completedSessions / Math.max(totalSessions, 1);
       const activityConsistency = reportsSubmitted / Math.max(totalSessions, 1);
       
       const performanceScore = (studentImprovement * 0.4) + (sessionCompletionRate * 100 * 0.3) + (activityConsistency * 100 * 0.3);
       
       await updateDoc(mRef, {
          totalSessions,
          completedSessions,
          reportsSubmitted,
          performanceScore: Math.round(performanceScore)
       });
    }
    
    showToast("✅ Final session report submitted and metrics evaluated.");
  };

  const requestExtraSession = async (studentId, date, time) => {
    if (!currentUser) return;
    
    const isDuplicate = sessions.some(s => 
      s.date === date && 
      s.time === time &&
      (s.status === 'scheduled' || s.status === 'pending')
    );
    if (isDuplicate) {
      throw new Error("Time slot conflict: You already have an active or pending session at this time.");
    }

    // Auto configure via mentor's primary subject
    const subject = mentor.subjects.length > 0 ? mentor.subjects[0] : "Discussion";
    
    await addDoc(collection(db, "sessions"), {
      mentor_id: currentUser.uid,
      student_id: studentId,
      status: 'pending',
      date: date,
      time: time,
      subject: subject,
      place: "Online Meeting"
    });
    showToast(`✅ Session request sent for ${date} at ${time}`);
  };

  const updateSessionStatus = async (sessionId, newStatus) => {
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, { status: newStatus });
    showToast(`✅ Session ${newStatus} successfully.`);
  };

  const handleReschedule = async (sessionId, action) => {
    const sessionRef = doc(db, "sessions", sessionId);
    if (action === 'approve') {
       await updateDoc(sessionRef, { status: 'scheduled' });
    } else if (action === 'reject') {
       await updateDoc(sessionRef, { status: 'scheduled' }); // or rejected depending on logic
    }
  };

  const requestReschedule = async (sessionId) => {
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, { status: 'reschedule_requested' });
  };

  const markSessionMissed = async (studentId, sessionId) => {
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, { status: 'missed' });

    const studentRef = doc(db, "students", studentId);
    const sSnap = await getDoc(studentRef);
    if (sSnap.exists()) {
      const currentMissed = sSnap.data().progress?.missedSessions || 0;
      await updateDoc(studentRef, {
        "progress.missedSessions": currentMissed + 1
      });
    }
  };

  const fetchQuizQuestions = async (studentId) => {
    try {
      const attemptsSnap = await getDocs(query(collection(db, "quizAttempts"), where("studentId", "==", studentId)));
      let usedIds = new Set();
      attemptsSnap.forEach(doc => {
         const d = doc.data();
         if(d.questionsUsed) d.questionsUsed.forEach(id => usedIds.add(id));
      });
      
      const qSnap = await getDocs(collection(db, "questions"));
      const allQuestions = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      let availableQuestions = allQuestions.filter(q => !usedIds.has(q.id));
      
      if (availableQuestions.length < 3) {
         availableQuestions = allQuestions; // Graceful reset if pool exhausted
      }
      
      availableQuestions.sort(() => 0.5 - Math.random());
      return availableQuestions.slice(0, 3);
      
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const submitQuizAttempt = async (studentId, score, questionsUsed) => {
    const studentRef = doc(db, "students", studentId);
    const sSnap = await getDoc(studentRef);
    if (sSnap.exists()) {
      const todayStr = new Date().toISOString().split('T')[0];
      await addDoc(collection(db, "quizAttempts"), {
         studentId,
         date: todayStr,
         questionsUsed,
         score,
         createdAt: new Date().toISOString()
      });

      const data = sSnap.data();
      const currentScores = data.progress?.quizScores || [];
      const currentPoints = data.progress?.points || 0;
      const currentBadges = data.progress?.badges || [];
      const currentProgressHistory = data.progressHistory || [];
      
      const newScores = [...currentScores, score];
      const newHistory = [...currentProgressHistory, { date: new Date().toISOString(), score }];
      const newPoints = currentPoints + 50 + (score > 80 ? 50 : 0);
      
      const newBadges = [...currentBadges];
      if (score >= 90 && !newBadges.includes("Quiz Master")) newBadges.push("Quiz Master");
      if (newScores.length >= 5 && !newBadges.includes("Consistent Learner")) newBadges.push("Consistent Learner");

      let bonusPoints = 0;
      let challengeUpdated = data.progress?.dailyChallenge || { task: "Complete Practice", completed: false, reward: 50 };
      if (!challengeUpdated.completed) {
         challengeUpdated.completed = true;
         bonusPoints += challengeUpdated.reward || 50;
         showToast(`🏆 Daily Challenge Completed! +${challengeUpdated.reward} pts`);
      }

      let studyTime = data.progress?.studyTime || { daily: 0, weekly: 0 };
      studyTime.daily += 15;
      studyTime.weekly += 15;

      let currentPath = data.progress?.learningPath || [];
      const activeIdx = currentPath.findIndex(p => p.status === 'unlocked');
      if (activeIdx !== -1 && score >= 70) {
        currentPath[activeIdx].status = 'completed';
        if (activeIdx + 1 < currentPath.length) {
          currentPath[activeIdx + 1].status = 'unlocked';
          setTimeout(() => showToast(`🔓 New Learning Topic Unlocked!`), 1000);
        }
      }

      const finalPoints = newPoints + bonusPoints;
      
      let actLog = data.progress?.activityLog ? [...data.progress.activityLog] : Array.from({length:14}, ()=>0);
      actLog[actLog.length - 1] += 2;

      await updateDoc(studentRef, {
        "progress.quizScores": newScores,
        "progressHistory": newHistory,
        "progress.points": finalPoints,
        "progress.badges": newBadges,
        "progress.dailyChallenge": challengeUpdated,
        "progress.studyTime": studyTime,
        "progress.learningPath": currentPath,
        "progress.activityLog": actLog,
        "progress.overall_performance": `Recently scored ${score}% on practice quiz.`
      });

      const uSnap = await getDoc(doc(db, "users", studentId));
      await setDoc(doc(db, "leaderboard", studentId), {
         name: uSnap.exists() ? uSnap.data().name : "Student",
         points: finalPoints,
         currentStreak: data.progress?.streak || 0
      }, { merge: true });
    }
  };

  const addDoubt = async (mentorId, text) => {
    if (!currentUser) return;
    await addDoc(collection(db, "doubts"), {
      student_id: currentUser.uid,
      mentor_id: mentorId,
      text: text,
      status: 'open',
      timestamp: new Date().toISOString()
    });
    showToast(`✉️ Doubt submitted to mentor smoothly.`);
  };

  const addStudentReport = async (studentId, reportText, sessionId) => {
    // 1. Push report to student doc
    const studentRef = doc(db, "students", studentId);
    const sSnap = await getDoc(studentRef);
    if (sSnap.exists()) {
      const sData = sSnap.data();
      const currentDate = new Date().toLocaleDateString();
      const oldPerf = sData.progress?.overall_performance || "";
      const prefix = oldPerf ? oldPerf + "\n\n" : "";
      
      await updateDoc(studentRef, {
        "progress.overall_performance": prefix + `[${currentDate}]: ${reportText}`
      });
    }

    // 2. Mark session as completed
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, { status: 'completed' });
  };

  const createAssignment = async (data) => {
    if (!currentUser) return;
    await addDoc(collection(db, "assignments"), {
      mentorId: currentUser.uid,
      status: 'pending',
      score: 0,
      createdAt: new Date().toISOString(),
      ...data
    });
    showToast(`📝 Assignment '${data.title}' created!`);
  };

  const submitAssignment = async (assignmentId, studentId) => {
    const asgRef = doc(db, "assignments", assignmentId);
    await updateDoc(asgRef, { status: 'completed', score: 50 });

    const studentRef = doc(db, "students", studentId);
    const sSnap = await getDoc(studentRef);
    if (sSnap.exists()) {
      const data = sSnap.data();
      const currentPoints = data.progress?.points || 0;
      const finalPoints = currentPoints + 50;
      
      let activityLog = data.progress?.activityLog || Array.from({length: 14}, () => 0);
      activityLog[activityLog.length - 1] += 1;
      const finalStreak = (data.progress?.streak || 0) + 1;
      
      await updateDoc(studentRef, {
        "progress.points": finalPoints,
        "progress.activityLog": activityLog,
        "progress.streak": finalStreak
      });

      const uSnap = await getDoc(doc(db, "users", studentId));
      await setDoc(doc(db, "leaderboard", studentId), {
         name: uSnap.exists() ? uSnap.data().name : "Student",
         points: finalPoints,
         currentStreak: finalStreak
      }, { merge: true });
    }
    showToast(`🎉 Assignment submitted! +50 Points & Streak Increased!`);
  };

  const submitDailyLog = async (studentId, mentorId, date, reflection, duration) => {
    try {
      await addDoc(collection(db, "dailyLogs"), {
        studentId,
        mentorId,
        date,
        reflection,
        duration,
        createdAt: new Date().toISOString()
      });

      const studentRef = doc(db, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
         const sData = studentSnap.data();
         const finalPoints = (sData.progress?.points || 0) + 20; 
         
         let actLog = sData.progress?.activityLog || Array.from({length: 14}, () => 0);
         actLog[actLog.length - 1] += 2; 

         await updateDoc(studentRef, { 
             "progress.points": finalPoints,
             "progress.activityLog": actLog
         });
         
         const uSnap = await getDoc(doc(db, "users", studentId));
         await setDoc(doc(db, "leaderboard", studentId), {
            name: uSnap.exists() ? uSnap.data().name : "Student",
            points: finalPoints,
            currentStreak: sData.progress?.streak || 0
         }, { merge: true });
      }

      showToast(`📝 Reflection saved! +20 Points!`);
    } catch(err) {
      console.error(err);
      showToast("Error saving reflection.");
    }
  };

  const value = {
    mentor,
    students,
    sessions,
    leaderboard,
    availability,
    assignments,
    updateMentorProfile,
    addAvailability,
    bookSession,
    requestExtraSession,
    updateSessionStatus,
    handleReschedule,
    submitSessionReport,
    requestReschedule,
    submitQuizAttempt,
    fetchQuizQuestions,
    addStudentReport,
    addDoubt,
    createAssignment,
    submitAssignment,
    submitDailyLog,
    dailyLogs,
    doubts,
    toastMessage
  };

  return (
    <PortalContext.Provider value={value}>
      {children}
      {toastMessage && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: '24px', right: '24px', background: 'var(--surface)',
          padding: '1rem 1.5rem', borderRadius: '8px', zIndex: 9999,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)', borderLeft: '4px solid var(--secondary)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--text-main)',
          transition: 'all 0.3s ease'
        }}>
          {toastMessage}
        </div>
      )}
    </PortalContext.Provider>
  );
};
