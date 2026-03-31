import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PortalProvider } from './context/PortalContext';
import ProtectedRoute from './components/ProtectedRoute';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MentorProfile from './pages/MentorProfile';
import StudentDetails from './pages/StudentDetails';

import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import StudentDashboard from './pages/Student/StudentDashboard';
import NGODashboard from './pages/NGO/NGODashboard';

function App() {
  return (
    <AuthProvider>
      <PortalProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Mentor Portal (Original Layout) */}
            <Route path="/" element={<ProtectedRoute allowedRoles={['Mentor']}><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<MentorProfile />} />
              <Route path="student/:id" element={<StudentDetails />} />
            </Route>

            {/* New Roles Dashboards without Mentor Layout */}
            <Route path="/student-dashboard" element={
              <ProtectedRoute allowedRoles={['Student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/ngo-dashboard" element={
              <ProtectedRoute allowedRoles={['NGO']}>
                <NGODashboard />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </PortalProvider>
    </AuthProvider>
  );
}

export default App;
