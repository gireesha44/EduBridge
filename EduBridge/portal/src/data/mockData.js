export const initialMentor = {
  id: "m-001",
  name: "Dr. Sarah Jenkins",
  subjects: ["Mathematics", "Physics"],
  ageGroup: "High School (14-18)",
  qualifications: "Ph.D. in Physics, M.Sc in Applied Mathematics",
  performance: {
    totalSessions: 142,
    attendance: 98,
    studentImprovementTrend: "Positive (+12%)"
  }
};

export const initialStudents = [
  {
    id: "s-001",
    name: "Alex Carter",
    class: "10th Grade",
    weak_subjects: ["Physics", "Geometry"],
    quizScores: [65, 70, 68, 85, 88], // Improving
    badges: ["Fast Learner", "Curious Mind"],
    points: 1250,
    missedSessions: 0,
    overall_performance: "Alex has shown consistent growth over the past few weeks, recovering well from initial hurdles in Geometry and adapting to the advanced Physics concepts. Engagement and curiosity remain very high during live sessions."
  },
  {
    id: "s-002",
    name: "Jamie Lin",
    class: "9th Grade",
    weak_subjects: ["Algebra"],
    quizScores: [90, 88, 89, 90, 91], // Stable
    badges: ["Perfect Attendance"],
    points: 2100,
    missedSessions: 0,
    overall_performance: "Jamie is performing exceptionally well with stable and high scores. They have perfectly mastered basic Algebra and consistently attend and participate. The focus should shift towards introduction to intermediate Algebra challenges."
  },
  {
    id: "s-003",
    name: "Morgan Smith",
    class: "11th Grade",
    weak_subjects: ["Calculus", "Physics"],
    quizScores: [75, 70, 65, 50, 45], // Declining (Risk)
    badges: [],
    points: 300,
    missedSessions: 2, // Missing sessions (Risk)
    overall_performance: "Morgan is currently struggling to keep pace, reflected by dipping scores and missed sessions. Their foundational grasp of Calculus needs immediate reinforcement, and they may be facing external distractions impacting attendance."
  }
];

export const initialSessions = [
  {
    id: "sess-001",
    mentor_id: "m-001",
    student_id: "s-001",
    subject: "Physics",
    date: "2026-04-05",
    time: "14:00",
    place: "Online Meeting Room A",
    status: "scheduled"
  },
  {
    id: "sess-002",
    mentor_id: "m-001",
    student_id: "s-003",
    subject: "Calculus",
    date: "2026-04-06",
    time: "15:30",
    place: "Library Room 3",
    status: "reschedule_requested",
    rescheduleReason: "Family emergency"
  }
];

// Slots mapped by YYYY-MM-DD
export const initialAvailability = {
  "2026-04-05": ["10:00", "11:30", "14:00", "16:00"],
  "2026-04-06": ["09:00", "13:00", "14:30", "15:30"],
  "2026-04-07": ["10:00", "15:00", "17:00"]
};
