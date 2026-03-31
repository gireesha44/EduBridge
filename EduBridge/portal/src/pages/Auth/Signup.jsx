import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, AlertCircle, BookOpen } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Student'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Student-specific bridging states
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [classLevel, setClassLevel] = useState('Class 10');

  useEffect(() => {
    const fetchMentorSubjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'mentors'));
        const subjectSet = new Set();
        snap.docs.forEach(doc => {
          const mData = doc.data();
          const subs = mData.subjects || mData.expertise || [];
          subs.forEach(sub => {
             const cleanSub = typeof sub === 'string' ? sub.trim() : sub;
             if (cleanSub) subjectSet.add(cleanSub);
          });
        });
        setAvailableSubjects(Array.from(subjectSet).sort());
      } catch (err) {
        console.error("Error fetching mentor subjects:", err);
      }
    };
    fetchMentorSubjects();
  }, []);
  
  const navigate = useNavigate();
  const { signup } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const additionalData = formData.role === 'Student' 
        ? { classLevel, weakSubjects: selectedSubjects } 
        : {};
      
      await signup(formData.email, formData.password, formData.name, formData.role, additionalData);
      switch (formData.role) {
        case 'Mentor': navigate('/dashboard'); break;
        case 'Student': navigate('/student-dashboard'); break;
        case 'NGO': navigate('/ngo-dashboard'); break;
        default: navigate('/'); break;
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create an account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center animate-fade-in" style={{ minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-card" style={{ maxWidth: '450px', width: '100%', padding: '2.5rem' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="flex-center gap-2 text-gradient" style={{ marginBottom: '1rem' }}>
            <BookOpen size={28} color="var(--primary)" />
            <h2 style={{ margin: 0 }}>EduBridge</h2>
          </div>
          <h3>Create an Account</h3>
          <p>Join the mentor portal today</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ 
              background: '#FEE2E2', color: 'var(--danger)', padding: '0.8rem', 
              borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' 
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="name"
              required
              className="form-input"
              placeholder="Jane Doe"
              value={formData.name}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              required
              className="form-input"
              placeholder="jane@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength="6"
              className="form-input"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">I am a...</label>
            <select
              name="role"
              required
              className="form-select"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="Student">Student (Looking for guidance)</option>
              <option value="Mentor">Mentor (Ready to guide)</option>
              <option value="NGO">NGO Administrator</option>
            </select>
          </div>

          {formData.role === 'Student' && (
            <div className="animate-fade-in" style={{ background: '#F9FAFB', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
               <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>Student Profile Setup</h4>
               
               <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Current Class / Grade</label>
                  <select className="form-select" value={classLevel} onChange={e => setClassLevel(e.target.value)}>
                    {Array.from({length: 10}, (_, i) => i + 1).map(num => (
                      <option key={num} value={`Class ${num}`}>Class {num}</option>
                    ))}
                  </select>
               </div>

               <div className="form-group" style={{ marginBottom: 0 }}>
                 <label className="form-label">Subjects I need help with (select at least one)</label>
                 <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', marginTop: 0 }}>
                   * We only show subjects our current mentors actively teach!
                 </p>
                 
                 {availableSubjects.length > 0 ? (
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                     {availableSubjects.map(sub => (
                       <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                         <input 
                           type="checkbox" 
                           checked={selectedSubjects.includes(sub)}
                           onChange={(e) => {
                             if(e.target.checked) setSelectedSubjects([...selectedSubjects, sub]);
                             else setSelectedSubjects(selectedSubjects.filter(s => s !== sub));
                           }}
                         />
                         {sub}
                       </label>
                     ))}
                   </div>
                 ) : (
                   <p style={{ fontSize: '0.85rem', color: '#B45309' }}>Loading subjects or no mentors available...</p>
                 )}
               </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (formData.role === 'Student' && selectedSubjects.length === 0)}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
          >
            {loading ? 'Creating...' : <><UserPlus size={18} /> Create Account</>}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
