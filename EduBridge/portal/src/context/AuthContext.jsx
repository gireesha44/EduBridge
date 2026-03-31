import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { suggestMentor } from '../services/aiService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Signup with specific role
  const signup = async (email, password, name, role, additionalData = {}) => {
    try {
      // NGO Auth Restrictor Pattern
      let pendingMentorDoc = null;
      if (role === 'Mentor') {
         const authCheckQ = query(collection(db, "pendingMentors"), where("email", "==", email.toLowerCase().trim()));
         const authCheckSnap = await getDocs(authCheckQ);
         
         // We allow seeded demos to bypass this for testing purposes
         const seededQ = query(collection(db, "users"), where("email", "==", email), where("isSeeded", "==", true));
         const isSeededDemo = !(await getDocs(seededQ)).empty;
         
         if (authCheckSnap.empty && !isSeededDemo) {
            throw new Error("You are not authorized. Contact NGO.");
         }
         if (!authCheckSnap.empty) {
            pendingMentorDoc = authCheckSnap.docs[0];
         }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 1. Check if seeded demo data exists for this email
      const q = query(collection(db, "users"), where("email", "==", email), where("isSeeded", "==", true));
      const seededSnap = await getDocs(q);

      if (!seededSnap.empty) {
        // --- MATCH FOUND: MIGRATE DATA TO NEW UID ---
        const seededDoc = seededSnap.docs[0];
        const oldId = seededDoc.id;
        const seededData = seededDoc.data();
        const actualRole = seededData.role;

        // Clone base user document
        await setDoc(doc(db, "users", user.uid), { ...seededData, isSeeded: false, realUidMapped: true });

        if (actualRole === 'Student') {
          const rSnap = await getDoc(doc(db, "students", oldId));
          if (rSnap.exists()) await setDoc(doc(db, "students", user.uid), rSnap.data());

          // Update Foreign Keys in Sessions
          const ssSnap = await getDocs(query(collection(db, "sessions"), where("student_id", "==", oldId)));
          ssSnap.forEach(async (d) => await updateDoc(d.ref, { student_id: user.uid }));

          // Update Foreign Keys in Assignments
          const asgSnap = await getDocs(query(collection(db, "assignments"), where("studentId", "==", oldId)));
          asgSnap.forEach(async (d) => await updateDoc(d.ref, { studentId: user.uid }));

          // Update Foreign Keys in Daily Logs (Student)
          const dlSnap = await getDocs(query(collection(db, "dailyLogs"), where("studentId", "==", oldId)));
          dlSnap.forEach(async (d) => await updateDoc(d.ref, { studentId: user.uid }));

          // Update Foreign Keys in Mentor's assigned arrays
          // Note: array-contains returns all mentors with the old ID.
          const mmSnap = await getDocs(query(collection(db, "mentors")));
          mmSnap.forEach(async (m) => {
             const mData = m.data();
             if (mData.assignedStudents && mData.assignedStudents.includes(oldId)) {
                const newArr = mData.assignedStudents.map(s => s === oldId ? user.uid : s);
                await updateDoc(m.ref, { assignedStudents: newArr });
             }
          });
        } 
        else if (actualRole === 'Mentor') {
          const rSnap = await getDoc(doc(db, "mentors", oldId));
          if (rSnap.exists()) await setDoc(doc(db, "mentors", user.uid), rSnap.data());

          // Update Sessions
          const ssSnap = await getDocs(query(collection(db, "sessions"), where("mentor_id", "==", oldId)));
          ssSnap.forEach(async (d) => await updateDoc(d.ref, { mentor_id: user.uid }));

          // Update Assignments
          const asgSnap = await getDocs(query(collection(db, "assignments"), where("mentorId", "==", oldId)));
          asgSnap.forEach(async (d) => await updateDoc(d.ref, { mentorId: user.uid }));

          // Update Daily Logs (Mentor)
          const dlSnap = await getDocs(query(collection(db, "dailyLogs"), where("mentorId", "==", oldId)));
          dlSnap.forEach(async (d) => await updateDoc(d.ref, { mentorId: user.uid }));

          // Update Students
          const stSnap = await getDocs(query(collection(db, "students"), where("assignedMentorId", "==", oldId)));
          stSnap.forEach(async (d) => await updateDoc(d.ref, { assignedMentorId: user.uid }));
        } 
        else if (actualRole === 'NGO') {
          const rSnap = await getDoc(doc(db, "ngos", oldId));
          if (rSnap.exists()) await setDoc(doc(db, "ngos", user.uid), rSnap.data());
        }

        // Cleanup temporary records
        await deleteDoc(doc(db, "users", oldId));
        if (actualRole.toLowerCase() === 'ngo') await deleteDoc(doc(db, "ngos", oldId));
        else await deleteDoc(doc(db, actualRole.toLowerCase() + "s", oldId));

        setUserRole(actualRole);
        setCurrentUser({ ...user, displayName: seededData.name });
        return { user, role: actualRole };

      } else {
        // --- NO MATCH: CREATE FALLBACK BLANK PROFILE ---
        await setDoc(doc(db, "users", user.uid), {
          name,
          email,
          role,
          createdAt: new Date().toISOString(),
          isActive: true
        });

        // Initialize specific role collections based on requirement
        if (role === 'Mentor') {
          const mData = pendingMentorDoc ? pendingMentorDoc.data() : { subjects: [] };
          const mentorSubjects = mData.subjects || [];
          
          let newlyAssignedStudents = [];
          
          // ---- NEW AUTO-ASSIGN SWEEP FOR UNASSIGNED STUDENTS ----
          try {
             const sSnap = await getDocs(collection(db, "students"));
             const unassignedStudents = sSnap.docs.filter(d => !d.data().assignedMentorId);

             for (let sDoc of unassignedStudents) {
                if (newlyAssignedStudents.length >= 5) break; // capacity limit
                
                const sData = sDoc.data();
                const sSubj = sData.weakSubjects && sData.weakSubjects.length > 0 ? sData.weakSubjects[0] : null;
                
                if (sSubj && mentorSubjects.includes(sSubj)) {
                   newlyAssignedStudents.push(sDoc.id);
                   await updateDoc(doc(db, "students", sDoc.id), {
                      assignedMentorId: user.uid,
                      matchingReason: ["subject", "availability (new mentor auto-sweep)"]
                   });
                }
             }
          } catch(err) {
             console.error("Auto-assign sweep failed:", err);
          }
          // --------------------------------------------------------

          await setDoc(doc(db, "mentors", user.uid), {
             name,
             email,
             subjects: mentorSubjects,
             assignedStudents: newlyAssignedStudents,
             totalSessions: 0,
             completedSessions: 0,
             reportsSubmitted: 0,
             performanceScore: 0
          });

          if (pendingMentorDoc) {
             await deleteDoc(doc(db, "pendingMentors", pendingMentorDoc.id));
          }
        } else if (role === 'Student') {
          // --- AUTO-ASSIGN ENGINE VIA AI ---
          let assignedMentorId = null;
          let matchingReason = null;
          if (additionalData.weakSubjects && additionalData.weakSubjects.length > 0) {
            const mSnap = await getDocs(collection(db, "mentors"));
            let allMentors = [];
            mSnap.forEach(mDoc => {
               allMentors.push({ id: mDoc.id, ...mDoc.data() });
            });
            
            if (allMentors.length > 0) {
               const stPayload = { ...additionalData, classLevel: additionalData.classLevel || 'Class 10' };
               assignedMentorId = await suggestMentor(stPayload, allMentors);
               
               if (assignedMentorId) {
                 matchingReason = ["AI Intelligent Match", "subject", "performance", "availability"];
                 await updateDoc(doc(db, "mentors", assignedMentorId), {
                   assignedStudents: arrayUnion(user.uid)
                 });
               }
            }
          }

          const pSubject = additionalData.weakSubjects && additionalData.weakSubjects.length > 0 ? additionalData.weakSubjects[0] : "your main subject";
          await setDoc(doc(db, "students", user.uid), {
            assignedMentorId: assignedMentorId,
            matchingReason: matchingReason,
            classLevel: additionalData.classLevel || 'Class 10',
            weakSubjects: additionalData.weakSubjects || [],
            progressHistory: [],
            progress: {
              quizScores: [],
              badges: [],
              points: 0,
              missedSessions: 0,
              overall_performance: "New Student! Ready to learn.",
              learningPath: [
                { id: 1, title: `Introduction to ${pSubject}`, status: "unlocked" },
                { id: 2, title: `Core ${pSubject} Fundamentals`, status: "locked" },
                { id: 3, title: `Intermediate Applications`, status: "locked" },
                { id: 4, title: `Advanced Mastery`, status: "locked" }
              ]
            }
          });
        } else if (role === 'NGO') {
          await setDoc(doc(db, "ngos", user.uid), {
            name,
            students: [],
            mentors: []
          });
        }

        setUserRole(role);
        setCurrentUser({ ...user, displayName: name });
        return { user, role };
      }
    } catch (error) {
      throw error;
    }
  };

  // Login
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Fetch role after login
    const userDocRef = doc(db, "users", user.uid);
    let userDocSnap = await getDoc(userDocRef);
    
    // Auth exists but Firestore profile is missing? Let's check for seeded demo data to link.
    if (!userDocSnap.exists()) {
      const q = query(collection(db, "users"), where("email", "==", email), where("isSeeded", "==", true));
      const seededSnap = await getDocs(q);
      
      if (!seededSnap.empty) {
        // --- MATCH FOUND: MIGRATE DATA TO NEW UID ---
        const seededDoc = seededSnap.docs[0];
        const oldId = seededDoc.id;
        const seededData = seededDoc.data();
        const actualRole = seededData.role;

        await setDoc(doc(db, "users", user.uid), { ...seededData, isSeeded: false, realUidMapped: true });

        if (actualRole === 'Student') {
          const rSnap = await getDoc(doc(db, "students", oldId));
          if (rSnap.exists()) await setDoc(doc(db, "students", user.uid), rSnap.data());

          const ssSnap = await getDocs(query(collection(db, "sessions"), where("student_id", "==", oldId)));
          ssSnap.forEach(async (d) => await updateDoc(d.ref, { student_id: user.uid }));

          const asgSnap = await getDocs(query(collection(db, "assignments"), where("studentId", "==", oldId)));
          asgSnap.forEach(async (d) => await updateDoc(d.ref, { studentId: user.uid }));

          const dlSnap = await getDocs(query(collection(db, "dailyLogs"), where("studentId", "==", oldId)));
          dlSnap.forEach(async (d) => await updateDoc(d.ref, { studentId: user.uid }));

          const mmSnap = await getDocs(query(collection(db, "mentors")));
          mmSnap.forEach(async (m) => {
             const mData = m.data();
             if (mData.assignedStudents && mData.assignedStudents.includes(oldId)) {
                const newArr = mData.assignedStudents.map(s => s === oldId ? user.uid : s);
                await updateDoc(m.ref, { assignedStudents: newArr });
             }
          });
        } 
        else if (actualRole === 'Mentor') {
          const rSnap = await getDoc(doc(db, "mentors", oldId));
          if (rSnap.exists()) await setDoc(doc(db, "mentors", user.uid), rSnap.data());

          const ssSnap = await getDocs(query(collection(db, "sessions"), where("mentor_id", "==", oldId)));
          ssSnap.forEach(async (d) => await updateDoc(d.ref, { mentor_id: user.uid }));

          const asgSnap = await getDocs(query(collection(db, "assignments"), where("mentorId", "==", oldId)));
          asgSnap.forEach(async (d) => await updateDoc(d.ref, { mentorId: user.uid }));

          const dlSnap = await getDocs(query(collection(db, "dailyLogs"), where("mentorId", "==", oldId)));
          dlSnap.forEach(async (d) => await updateDoc(d.ref, { mentorId: user.uid }));

          const stSnap = await getDocs(query(collection(db, "students"), where("assignedMentorId", "==", oldId)));
          stSnap.forEach(async (d) => await updateDoc(d.ref, { assignedMentorId: user.uid }));
        } 
        else if (actualRole === 'NGO') {
          const rSnap = await getDoc(doc(db, "ngos", oldId));
          if (rSnap.exists()) await setDoc(doc(db, "ngos", user.uid), rSnap.data());
        }

        // Cleanup temporary records
        await deleteDoc(doc(db, "users", oldId));
        if (actualRole.toLowerCase() === 'ngo') await deleteDoc(doc(db, "ngos", oldId));
        else await deleteDoc(doc(db, actualRole.toLowerCase() + "s", oldId));

        userDocSnap = await getDoc(userDocRef); // refresh snap for returning below
      }
    }

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      setUserRole(userData.role);
      setCurrentUser({ ...user, displayName: userData.name });
      return { user, role: userData.role };
    } else {
      throw new Error("User record not found in database. Create an account first.");
    }
  };

  // Logout
  const logout = () => {
    setUserRole(null);
    return signOut(auth);
  };

  // Observe auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Fetch role if user exists
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserRole(userData.role);
            setCurrentUser({ ...user, displayName: userData.name });
          } else {
            setCurrentUser(user);
            setUserRole(null);
          }
        } else {
          setCurrentUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setCurrentUser(null);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
          Initializing Platform...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
