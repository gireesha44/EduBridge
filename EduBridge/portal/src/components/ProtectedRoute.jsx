import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole } = useAuth();
  
  if (!currentUser) {
    // Not logged in, redirect to login
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Logged in but wrong role, redirect to correct dashboard
    if (userRole === 'Mentor') return <Navigate to="/dashboard" replace />;
    if (userRole === 'Student') return <Navigate to="/student-dashboard" replace />;
    if (userRole === 'NGO') return <Navigate to="/ngo-dashboard" replace />;
    // Fallback
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
