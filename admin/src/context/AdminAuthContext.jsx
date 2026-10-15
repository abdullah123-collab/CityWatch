import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext(null);

async function parseApiResponse(res, fallbackMessage = 'Request could not be completed.') {
  let data = {};
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    if (!res.ok) {
      if (res.status === 502 || res.status === 504 || res.status === 503) {
        throw new Error('Cannot connect to CityWatch API server (Port 3000). Please ensure the backend is running.');
      }
      throw new Error(fallbackMessage);
    }
  }
  if (!res.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await parseApiResponse(res);
        if (data.user && data.user.role_name === 'Admin') {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  async function login(email, password) {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    const data = await parseApiResponse(res, 'Failed to authenticate admin.');
    if (data.user.role_name !== 'Admin') {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      throw new Error('Access denied. This portal requires Administrator privileges.');
    }
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  }

  return (
    <AdminAuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      refreshUser: checkAuth
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return context;
}
