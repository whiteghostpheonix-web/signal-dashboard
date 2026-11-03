import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminAuth from './AdminAuth.jsx';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminAuth>
      <App />
    </AdminAuth>
  </React.StrictMode>,
);
