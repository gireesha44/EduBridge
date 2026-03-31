import React, { useState } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Database, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

const SeedData = () => {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const clearSeedData = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const q = query(collection(db, "users"), where("isSeeded", "==", true));
      const seededSnap = await getDocs(q);
      
      let count = 0;
      const seededIdsList = seededSnap.docs.map(d => d.id);

      for (const docSnap of seededSnap.docs) {
          const uId = docSnap.id;
          const uData = docSnap.data();
          
          await deleteDoc(doc(db, "users", uId));
          if (uData.role === 'Student') {
             await deleteDoc(doc(db, "students", uId));
             await deleteDoc(doc(db, "leaderboard", uId));
             
             const sSess = await getDocs(query(collection(db, "sessions"), where("student_id", "==", uId)));
             sSess.forEach(async d => await deleteDoc(d.ref));
             
             const sAsg = await getDocs(query(collection(db, "assignments"), where("studentId", "==", uId)));
             sAsg.forEach(async d => await deleteDoc(d.ref));
             
             const sLog = await getDocs(query(collection(db, "dailyLogs"), where("studentId", "==", uId)));
             sLog.forEach(async d => await deleteDoc(d.ref));

          } else if (uData.role === 'Mentor') {
             await deleteDoc(doc(db, "mentors", uId));
             
             const mSess = await getDocs(query(collection(db, "sessions"), where("mentor_id", "==", uId)));
             mSess.forEach(async d => await deleteDoc(d.ref));
          } else if (uData.role === 'NGO') {
             await deleteDoc(doc(db, "ngos", uId));
          }
          count++;
      }
      
      const allMentorsSnap = await getDocs(collection(db, "mentors"));
      for(const mDoc of allMentorsSnap.docs) {
          const mData = mDoc.data();
          if (mData.assignedStudents && Array.isArray(mData.assignedStudents)) {
              const cleanedList = mData.assignedStudents.filter(id => !seededIdsList.includes(id));
              if (cleanedList.length !== mData.assignedStudents.length) {
                  await updateDoc(doc(db, "mentors", mDoc.id), { assignedStudents: cleanedList });
              }
          }
      }

      setMsg({ type: 'success', text: `Cleaned ${count} demo accounts & unlinked remaining!` });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Error cleaning seeded data: ' + err.message });
    }
    setLoading(false);
  };

  const seedDatabase = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const q = query(collection(db, "users"), where("email", "==", "ngo@demo.com"));
      const existing = await getDocs(q);
      if (!existing.empty) {
        setMsg({ type: 'warning', text: 'Demo data already exists!' });
        setLoading(false);
        return;
      }

      // Generate random unique ID string
      const generateId = (prefix) => prefix + '_' + Math.random().toString(36).substr(2, 9);
      
      const ngoId = generateId('tmp_ngo');
      await setDoc(doc(db, "users", ngoId), { name: "EduBridge Demo NGO", email: "ngo@demo.com", role: "NGO", isSeeded: true, createdAt: new Date().toISOString(), isActive: true });
      await setDoc(doc(db, "ngos", ngoId), { name: "EduBridge Demo NGO", students: [], mentors: [] });

      const mentorIds = [];
      const mentorsData = [
        { name: "Alice Johnson", email: "mentor1@demo.com", role: "Mentor" },
        { name: "Bob Smith", email: "mentor2@demo.com", role: "Mentor" },
        { name: "Carol Davis", email: "mentor3@demo.com", role: "Mentor" }
      ];

      for (const m of mentorsData) {
        const mid = generateId('tmp_mentor');
        await setDoc(doc(db, "users", mid), { ...m, isSeeded: true, createdAt: new Date().toISOString(), isActive: true });
        await setDoc(doc(db, "mentors", mid), {
          expertise: ["Math", "Science"],
          bio: "Experienced Demo Mentor ready to guide students.",
          assignedStudents: [],
          availability: [
            { date: new Date().toLocaleDateString(), time: "10:00 AM" },
            { date: new Date().toLocaleDateString(), time: "02:00 PM" }
          ],
          performance: { totalSessions: 5, attendance: 100, studentImprovementTrend: "+15%" }
        });
        mentorIds.push(mid);
      }

      const studentsData = [
        { name: "John Doe", email: "student1@demo.com", class: "Grade 10" },
        { name: "Emily Chen", email: "student2@demo.com", class: "Grade 9" },
        { name: "Michael Ray", email: "student3@demo.com", class: "Grade 11" },
        { name: "Sara Connor", email: "student4@demo.com", class: "Grade 8" },
        { name: "David Kim", email: "student5@demo.com", class: "Grade 12" }
      ];

      const studentIds = [];
      for (let i = 0; i < studentsData.length; i++) {
        const s = studentsData[i];
        const sid = generateId('tmp_student');
        const assignedMentor = mentorIds[i % mentorIds.length]; // Round robin assignment
        
        await setDoc(doc(db, "users", sid), { name: s.name, email: s.email, role: "Student", isSeeded: true, createdAt: new Date().toISOString(), isActive: true, class: s.class });
        await setDoc(doc(db, "students", sid), {
          assignedMentorId: assignedMentor,
          weakSubjects: ["Mathematics", "Physics"],
          progress: {
            quizScores: [65, 75, 80, 85, 90],
            badges: ["Early Bird"],
            points: 150 + (i * 20),
            missedSessions: i === 0 ? 2 : 0,
            overall_performance: "Demonstrating consistent improvement.",
            streak: i === 0 ? 0 : Math.floor(Math.random() * 5) + 1,
            lastActiveDate: new Date().toLocaleDateString(),
            activityLog: Array.from({ length: 14 }, () => Math.random() > 0.4 ? Math.floor(Math.random() * 4) + 1 : 0),
            studyTime: { daily: Math.floor(Math.random() * 60) + 20, weekly: Math.floor(Math.random() * 300) + 100 },
            dailyChallenge: { task: "Complete 1 Practice Quiz", completed: false, reward: 50 },
            learningPath: [
              { id: 1, title: "Introduction Concepts", status: "completed" },
              { id: 2, title: "Core Fundamentals", status: "unlocked" },
              { id: 3, title: "Intermediate Applications", status: "locked" },
              { id: 4, title: "Advanced Mastery", status: "locked" }
            ]
          }
        });

        await setDoc(doc(db, "leaderboard", sid), {
           name: s.name,
           points: 150 + (i * 20),
           currentStreak: i === 0 ? 0 : Math.floor(Math.random() * 5) + 1
        });

        studentIds.push({ sid, mId: assignedMentor, name: s.name });
      }

      // Update Mentors assigned students array:
      for (const m of mentorIds) {
         const assigned = studentIds.filter(s => s.mId === m).map(s => s.sid);
         await setDoc(doc(db, "mentors", m), { assignedStudents: assigned }, { merge: true });
      }

      // Generate Sessions and Assignments
      for (const pair of studentIds) {
        const sessId = generateId('tmp_sess');
        await setDoc(doc(db, "sessions", sessId), {
          mentor_id: pair.mId,
          student_id: pair.sid,
          subject: "Science 101",
          date: new Date().toLocaleDateString(),
          time: "02:00 PM",
          status: pair.sid === studentIds[0].sid ? "missed" : "scheduled"
        });

        const asg1Id = generateId('tmp_asg1');
        await setDoc(doc(db, "assignments", asg1Id), {
          studentId: pair.sid,
          mentorId: pair.mId,
          title: "Algebra Practice Worksheet",
          description: "Please complete exercises 1 to 15 regarding linear equations.",
          subject: "Mathematics",
          dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
          status: 'pending',
          score: 0,
          studentName: pair.name,
          createdAt: new Date().toISOString()
        });

        const asg2Id = generateId('tmp_asg2');
        await setDoc(doc(db, "assignments", asg2Id), {
          studentId: pair.sid,
          mentorId: pair.mId,
          title: "Physics Lab Report",
          description: "Write down the findings from yesterday's velocity experiment.",
          subject: "Science",
          dueDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
          status: 'completed',
          score: 50,
          studentName: pair.name,
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString()
        });

        const logId = generateId('tmp_dlog');
        await setDoc(doc(db, "dailyLogs", logId), {
          studentId: pair.sid,
          mentorId: pair.mId,
          date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
          reflection: "I spent 1.5 hours reviewing the physics lab materials and answering the worksheet. I feel much more confident with formulas now.",
          duration: "1 to 2 hours",
          createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
        });
        
        const logId2 = generateId('tmp_dlog');
        await setDoc(doc(db, "dailyLogs", logId2), {
          studentId: pair.sid,
          mentorId: pair.mId,
          date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
          reflection: "Read through my biology chapter. Found it a bit tough but I'll ask my mentor next session.",
          duration: "under 1 hour",
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
        });
      }

      // Generate Questions Pool
      const sampleQuestions = [
         { question: "What is 8 x 7?", options: ["54", "56", "62", "64"], correctAnswer: "56", subject: "Math" },
         { question: "What is the capital of France?", options: ["Berlin", "Madrid", "Paris", "Rome"], correctAnswer: "Paris", subject: "History" },
         { question: "What is the chemical symbol for Gold?", options: ["Au", "Ag", "Pb", "Fe"], correctAnswer: "Au", subject: "Science" },
         { question: "Who wrote Romeo and Juliet?", options: ["Charles Dickens", "William Shakespeare", "Mark Twain", "Jane Austen"], correctAnswer: "William Shakespeare", subject: "Literature" },
         { question: "What is the square root of 144?", options: ["10", "12", "14", "16"], correctAnswer: "12", subject: "Math" },
         { question: "Which planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Saturn"], correctAnswer: "Mars", subject: "Science" },
         { question: "What is 15% of 200?", options: ["20", "25", "30", "35"], correctAnswer: "30", subject: "Math" },
         { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], correctAnswer: "Carbon Dioxide", subject: "Science" },
         { question: "How many continents are there?", options: ["5", "6", "7", "8"], correctAnswer: "7", subject: "Geography" },
         { question: "What is the boiling point of water (C)?", options: ["90", "100", "110", "120"], correctAnswer: "100", subject: "Science" },
         { question: "What is the largest mammal in the world?", options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"], correctAnswer: "Blue Whale", subject: "Biology" },
         { question: "What is 3 squared?", options: ["6", "9", "12", "15"], correctAnswer: "9", subject: "Math" }
      ];

      for (const q of sampleQuestions) {
         const qId = generateId('tmp_q');
         await setDoc(doc(db, "questions", qId), { ...q });
      }

      setMsg({ type: 'success', text: '5 Students, 3 Mentors, and Quiz Pool seeded!' });
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Error seeding data: ' + err.message });
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button onClick={seedDatabase} className="btn" style={{ background: '#F0F9FF', color: '#0284C7', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', border: '1px solid #BAE6FD' }} disabled={loading}>
        <Database size={16} />
        {loading ? 'Processing...' : 'Seed Demo Data'}
      </button>
      <button onClick={clearSeedData} className="btn" style={{ background: '#FEF2F2', color: '#B91C1C', width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem', border: '1px solid #FECACA' }} disabled={loading}>
        <Trash2 size={16} />
        {loading ? 'Cleaning...' : 'Clear Demo Data'}
      </button>
      {msg.text && (
        <div style={{ padding: '0.5rem', fontSize: '0.85rem', color: msg.type === 'error' ? 'red' : msg.type === 'warning' ? '#B45309' : '#059669', background: msg.type === 'error' ? '#FEE2E2' : msg.type === 'warning' ? '#FEF3C7' : '#D1FAE5', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {msg.type === 'success' ? <CheckCircle size={14}/> : <AlertCircle size={14}/>} {msg.text}
        </div>
      )}
    </div>
  );
};

export default SeedData;
