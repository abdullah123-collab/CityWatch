import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuth } from './context/AdminAuthContext';

import AdminNavbar from './components/AdminNavbar';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminComplaintsPage from './pages/AdminComplaintsPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AdminCitizensPage from './pages/AdminCitizensPage';
import AdminDepartmentsPage from './pages/AdminDepartmentsPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';

function AdminGuard({ children }) {
  const { user, loading } = useAdminAuth();
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-muted)' }}>
        Verifying administrator credentials with Microsoft SQL Server…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-container">
      <AdminNavbar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />

          <Route
            path="/"
            element={
              <AdminGuard>
                <AdminDashboardPage />
              </AdminGuard>
            }
          />

          <Route
            path="/complaints"
            element={
              <AdminGuard>
                <AdminComplaintsPage />
              </AdminGuard>
            }
          />

          <Route
            path="/staff"
            element={
              <AdminGuard>
                <AdminStaffPage />
              </AdminGuard>
            }
          />

          <Route
            path="/citizens"
            element={
              <AdminGuard>
                <AdminCitizensPage />
              </AdminGuard>
            }
          />

          <Route
            path="/departments"
            element={
              <AdminGuard>
                <AdminDepartmentsPage />
              </AdminGuard>
            }
          />

          <Route
            path="/feedback"
            element={
              <AdminGuard>
                <AdminFeedbackPage />
              </AdminGuard>
            }
          />

          <Route
            path="/audit-logs"
            element={
              <AdminGuard>
                <AdminAuditLogsPage />
              </AdminGuard>
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
