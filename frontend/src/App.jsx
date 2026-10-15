import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewComplaintPage from './pages/NewComplaintPage';
import ComplaintHistoryPage from './pages/ComplaintHistoryPage';
import ComplaintDetailsPage from './pages/ComplaintDetailsPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
        Authenticating session with Microsoft SQL Server…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/complaints"
            element={
              <ProtectedRoute>
                <ComplaintHistoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/complaints/new"
            element={
              <ProtectedRoute>
                <NewComplaintPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/complaints/:id"
            element={
              <ProtectedRoute>
                <ComplaintDetailsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="*"
            element={
              <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>404 — Page Not Found</h1>
                <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                  The requested civic resource does not exist.
                </p>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
