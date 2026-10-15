import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, PlusCircle, LayoutDashboard, History, User, LogOut, LogIn } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <div className="brand-icon">
            <ShieldAlert size={20} />
          </div>
          <span>CityWatch</span>
        </Link>

        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            Home
          </NavLink>

          {user ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <LayoutDashboard size={16} />
                Dashboard
              </NavLink>
              <NavLink to="/complaints" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                <History size={16} />
                My Complaints
              </NavLink>
              <NavLink to="/complaints/new" className={({ isActive }) => `btn btn-primary btn-sm`}>
                <PlusCircle size={16} />
                Report Issue
              </NavLink>
              <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <User size={16} />
                {user.full_name.split(' ')[0]}
              </NavLink>
              <button onClick={handleLogout} className="btn btn-outline btn-sm" title="Sign Out">
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <LogIn size={16} />
                Sign In
              </NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
