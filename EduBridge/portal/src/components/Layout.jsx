import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCircle, LogOut, BookOpen } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { mentor } = usePortal();
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar glass-card" style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div className="flex-center gap-2 text-gradient">
            <BookOpen size={28} color="var(--primary)" />
            <h2>EduBridge</h2>
          </div>
          <p style={{ fontSize: '0.8rem', textAlign: 'center', marginTop: '0.5rem' }}>Mentor Portal</p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavLink 
            to="/dashboard" 
            style={({isActive}) => ({
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', 
              borderRadius: '8px', color: isActive ? 'var(--primary)' : 'var(--text-main)',
              background: isActive ? 'var(--glass-bg)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
            })}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>

          <NavLink 
            to="/profile" 
            style={({isActive}) => ({
              display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', 
              borderRadius: '8px', color: isActive ? 'var(--primary)' : 'var(--text-main)',
              background: isActive ? 'var(--glass-bg)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
              boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
            })}
          >
            <UserCircle size={20} />
            My Profile
          </NavLink>
        </nav>

        <div style={{ background: 'rgba(79, 70, 229, 0.05)', padding: '1rem', borderRadius: '12px' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>{currentUser?.displayName || mentor.name}</p>
          <button 
            onClick={handleLogout}
            className="btn" 
            style={{ width: '100%', marginTop: '1rem', background: '#FEE2E2', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.8rem' }}
          >
            <LogOut size={16} style={{ marginRight: '0.5rem' }} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
