import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ShieldCheck, LayoutDashboard, FileText, Users, Building2, Star, ScrollText, LogOut } from 'lucide-react';

export default function AdminNavbar() {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand">
          <ShieldCheck size={22} color="#60a5fa" />
          <span>CityWatch</span>
          <span className="brand-badge">Administrator</span>
        </Link>

        {user && (
          <nav className="nav-links">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard size={15} /> Dashboard
            </NavLink>
            <NavLink to="/complaints" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FileText size={15} /> Complaints
            </NavLink>
            <NavLink to="/staff" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={15} /> Staff
            </NavLink>
            <NavLink to="/citizens" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Citizens
            </NavLink>
            <NavLink to="/departments" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Building2 size={15} /> Departments
            </NavLink>
            <NavLink to="/feedback" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Star size={15} /> Feedback
            </NavLink>
            <NavLink to="/audit-logs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ScrollText size={15} /> Audit Logs
            </NavLink>

            <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} title="Sign Out">
              <LogOut size={14} />
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
