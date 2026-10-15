import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);
const API_UNAVAILABLE_MESSAGE =
  'Cannot connect to CityWatch API server (Port 3000). Please run "npm run dev:backend" in a separate terminal.';

async function parseApiResponse(res, fallbackMessage = 'Request could not be completed.') {
  let data = {};
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    if (!res.ok) {
      if (res.status >= 500 && res.status <= 504) {
        throw new Error(API_UNAVAILABLE_MESSAGE);
      }
      throw new Error(fallbackMessage);
    }
  }
  if (!res.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}

async function requestApi(url, options, fallbackMessage) {
  try {
    const res = await fetch(url, options);
    return await parseApiResponse(res, fallbackMessage);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(API_UNAVAILABLE_MESSAGE);
    }
    throw err;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await parseApiResponse(res);
        setUser(data.user);
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
    const data = await requestApi('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    }, 'Failed to sign in.');
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const data = await requestApi('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    }, 'Failed to register.');
    setUser(data.user);
    return data.user;
  }

  async function googleInitiate(idToken) {
    return await requestApi('/api/auth/google/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }, 'Google sign-in could not be initiated.');
  }

  async function googleVerifyOtp(email, otpCode, name) {
    const data = await requestApi('/api/auth/google/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, otpCode, name })
    }, 'Invalid OTP code.');
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
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      googleInitiate,
      googleVerifyOtp,
      logout,
      refreshUser: checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
