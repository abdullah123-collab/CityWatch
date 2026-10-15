import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { StaffAuthProvider } from './context/StaffAuthContext';
import App from './App';
import './styles/staff.css';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <StaffAuthProvider>
        <App />
      </StaffAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
