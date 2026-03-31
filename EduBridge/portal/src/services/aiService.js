const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
// Only access via environment variable (Vite prefix)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * 🤖 Core Gemini Engine
 * Uses prompt structured output (JSON Schema) to guarantee valid programmatic UI hooks.
 * Does NOT crash on failure, strictly falls back gracefully.
 */
async function askGemini(systemPrompt, userPrompt, jsonSchema = null) {
  if (!API_KEY) {
      console.warn("⚠️ VITE_GEMINI_API_KEY is missing. AI features gracefully disabled.");
      return null;
  }
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            ...(jsonSchema && { responseSchema: jsonSchema })
        }
      })
    });

    if (!response.ok) {
       console.error(`Gemini API Error: ${await response.text()}`);
       return null;
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (candidateText) {
       return JSON.parse(candidateText);
    }
    return null;
  } catch (error) {
    console.error("AI Service Network/Parse Error:", error);
    return null;
  }
}

// ---------------------------------------------------------
// 1. AI Student Analysis 
// ---------------------------------------------------------
export const analyzeStudent = async (studentData) => {
   const schema = {
      type: "OBJECT",
      properties: {
          level: { type: "STRING", enum: ["beginner", "intermediate", "advanced"] },
          weakTopics: { type: "ARRAY", items: { type: "STRING" } },
          recommendations: { type: "STRING" }
      },
      required: ["level", "weakTopics", "recommendations"]
   };
   
   const prompt = `Student Class: ${studentData.classLevel || 'Unknown'}
Weak Subjects: ${JSON.stringify(studentData.weakSubjects || [])}
Quiz History: ${JSON.stringify(studentData.progress?.quizScores || [])}
Analyze this student.`;

   const result = await askGemini(
       "You are an expert tutor. Classify the student's level based on their info, identify granular weak topics related to their subject, and provide a short robust recommendation.",
       prompt,
       schema
   );
   
   return result || { 
       level: "intermediate", 
       weakTopics: studentData.weakSubjects || ["General Subject"], 
       recommendations: "System AI unavailable. Continue with standard curriculum." 
   };
};

// ---------------------------------------------------------
// 2. AI Quiz Generation
// ---------------------------------------------------------
export const generateQuiz = async (subject, level, classLevel) => {
   const schema = {
      type: "ARRAY",
      items: {
         type: "OBJECT",
         properties: {
             question: { type: "STRING" },
             options: { type: "ARRAY", items: { type: "STRING" } },
             correctAnswer: { type: "STRING", description: "Must exactly match one of the options" }
         },
         required: ["question", "options", "correctAnswer"]
      }
   };
   
   const prompt = `Topic: ${subject}, Class Level: ${classLevel}, Student Level: ${level}. Generate 5 multiple-choice questions suitable for this intelligence.`;
   const result = await askGemini("You are a master teacher crafting adaptive quiz questions. Export exactly 5 MCQs safely.", prompt, schema);
   
   return result || [];
};

// ---------------------------------------------------------
// 3. AI Study Plan Generation
// ---------------------------------------------------------
export const generateStudyPlan = async (subject, level, classLevel) => {
   const schema = {
      type: "ARRAY",
      items: {
          type: "OBJECT",
          properties: {
              topic: { type: "STRING" },
              goal: { type: "STRING" },
              plan: { type: "STRING", description: "Step-by-step specific short execution plan" }
          },
          required: ["topic", "goal", "plan"]
      }
   };
   const prompt = `Subject: ${subject}, Intel Level: ${level}, Class: ${classLevel}. Give me a 3-step targeted study plan.`;
   const result = await askGemini("You are an AI Curriculum Designer building structural roadmaps.", prompt, schema);
   
   return result || [
       { topic: "Fundamentals of " + subject, goal: "Grasp the basics", plan: "Read chapter 1 and summarize." },
       { topic: "Core Application", goal: "Practical exercise", plan: "Complete worksheet A." }
   ];
};

// ---------------------------------------------------------
// 4. AI Session Generation (Auto-Fill)
// ---------------------------------------------------------
export const generateSessionPlan = async (studentData) => {
   const schema = {
       type: "OBJECT",
       properties: {
           topic: { type: "STRING" },
           activities: { 
               type: "ARRAY", 
               items: { type: "STRING" },
               description: "Strict 3 step array in order: 1 string for Teach, 1 for Practice, 1 for Quiz"
           }
       },
       required: ["topic", "activities"]
   };
   
   const subject = studentData.weakSubjects?.[0] || 'General Studies';
   const prompt = `Student Class: ${studentData.classLevel}, Primary Focus: ${subject}. Design a highly specific 60-minute session.`;
   
   const result = await askGemini("You are a mentor planning an exact session. Return 3 activities mapping to Teach -> Practice -> Quiz natively.", prompt, schema);
   return result || { 
       topic: `${subject} Core Session`, 
       activities: ["Teach core theory (15m)", "Guided interactive practice (30m)", "Quick assessment quiz (15m)"] 
   };
};

// ---------------------------------------------------------
// 5. AI Mentor Suggestion
// ---------------------------------------------------------
export const suggestMentor = async (studentData, mentors) => {
    // Only pass minimum viable payload constraints to save prompt length
    const candidates = mentors.map(m => ({
        id: m.id,
        subjects: m.subjects || [],
        capacity: m.assignedStudents?.length || 0,
        score: m.performanceScore || 0
    }));
    
    // Core fallback logic computed natively incase of API failure
    const subjectNeeded = studentData.weakSubjects?.[0] || '';
    const valid = mentors.filter(m => m.subjects?.includes(subjectNeeded));
    valid.sort((a,b) => (b.performanceScore||0) - (a.performanceScore||0));
    const fallbackMentorId = valid.length > 0 ? valid[0].id : null;

    const schema = {
        type: "OBJECT",
        properties: {
            mentorId: { type: "STRING" },
            reason: { type: "STRING" }
        },
        required: ["mentorId", "reason"]
    };
    
    const prompt = `Student Needs: Focus Subject: ${subjectNeeded}, Level: ${studentData.classLevel}.
Candidate Mentors: ${JSON.stringify(candidates)}
Pick the single best mentor ID based on optimal matrix (high score + subject match + lowest capacity).`;

    const result = await askGemini("You are an NGO admin routing algorithm optimally matching students.", prompt, schema);
    
    if (result && result.mentorId && mentors.find(m => m.id === result.mentorId)) {
        return result.mentorId; // AI intelligently chose
    }
    
    return fallbackMentorId; // Native fail-safe override
};

// ---------------------------------------------------------
// 6. AI Performance Evaluation
// ---------------------------------------------------------
export const evaluatePerformance = async (studentData) => {
   const schema = {
       type: "OBJECT",
       properties: {
           improvementTrend: { type: "STRING", enum: ["improving", "stagnant", "declining", "new"] },
           riskLevel: { type: "STRING", enum: ["low", "medium", "high"] }
       },
       required: ["improvementTrend", "riskLevel"]
   };
   
   const prompt = `Student Stats: 
Quiz Scores: ${JSON.stringify(studentData.progress?.quizScores || [])}
Missed Sessions: ${studentData.progress?.missedSessions || 0}
Streak: ${studentData.progress?.streak || 0}
Evaluate trend mathematically and output objective risk level.`;

   const result = await askGemini("You are an educational data analyst looking at time-series performance.", prompt, schema);
   return result || { improvementTrend: "new", riskLevel: "low" }; // Fallback
};
