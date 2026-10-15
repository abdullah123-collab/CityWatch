import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStaffAuth } from './context/StaffAuthContext';

import StaffNavbar from './components/StaffNavbar';
import StaffLoginPage from './pages/StaffLoginPage';
import StaffDashboardPage from './pages/StaffDashboardPage';
import StaffComplaintDetailPage from './pages/StaffComplaintDetailPage';
import StaffProfilePage from './pages/StaffProfilePage';

function StaffGuard({ children }) {
  const { user, loading } = useStaffAuth();
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
        Authenticating officer credentials with Microsoft SQL Server…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-container">
      <StaffNavbar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<StaffLoginPage />} />

          <Route
            path="/"
            element={
              <StaffGuard>
                <StaffDashboardPage />
              </StaffGuard>
            }
          />

          <Route
            path="/complaints/:id"
            element={
              <StaffGuard>
                <StaffComplaintDetailPage />
              </StaffGuard>
            }
          />

          <Route
            path="/profile"
            element={
              <StaffGuard>
                <StaffProfilePage />
              </StaffGuard>
            }
          />

          <Route
            path="*"
            element={
              <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
                <h2>Page Not Found</h2>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
