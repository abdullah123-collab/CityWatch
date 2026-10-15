import React, { createContext, useContext, useState, useEffect } from 'react';

const StaffAuthContext = createContext(null);

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

export function StaffAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await parseApiResponse(res);
        if (data.user && (data.user.role_name === 'Staff' || data.user.role_name === 'Admin')) {
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
    const data = await parseApiResponse(res, 'Failed to authenticate staff.');
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
    <StaffAuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      refreshUser: checkAuth
    }}>
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (!context) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return context;
}
