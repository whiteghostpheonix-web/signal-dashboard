import React, { useEffect, useState } from 'react';
import { API_BASE, api } from './config.js';

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export default function AdminAuth({ children }) {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showAdmins, setShowAdmins] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!localStorage.getItem('admin_token')) {
        if (active) setChecking(false);
        return;
      }
      try {
        const result = await api('/api/admin/me');
        if (active) setAdmin(result.admin);
      } catch {
        localStorage.removeItem('admin_token');
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function requestOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await postJson('/api/admin/request-otp', { email });
      setOtpSent(true);
      setMessage(result.message || 'If this address is authorized, a sign-in code will be sent.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await postJson('/api/admin/verify-otp', { email, otp });
      localStorage.setItem('admin_token', result.token);
      setAdmin(result.admin);
      setOtp('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch { /* clear local token regardless */ }
    localStorage.removeItem('admin_token');
    setAdmin(null);
    setOtpSent(false);
    setEmail('');
  }

  async function loadAdmins() {
    const result = await api('/api/admin/users');
    setAdmins(result.users || []);
  }

  async function addAdmin(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: newAdminEmail, display_name: newAdminName }),
      });
      setNewAdminEmail('');
      setNewAdminName('');
      setMessage('Admin added. They can sign in using an OTP sent to their email.');
      await loadAdmins();
    } catch (e) {
      setError(e.message);
    }
  }

  if (checking) return <div className="app"><div className="loading">Checking admin session…</div></div>;

  if (!admin) {
    return (
      <main className="app admin-login-page">
        <section className="card admin-login-card">
          <h1>Signal Electronics — Admin</h1>
          <p>Sign in with an authorized admin email. We’ll send you a one-time code.</p>
          {error && <div className="error" role="alert">{error}</div>}
          {message && <p role="status">{message}</p>}
          {!otpSent ? (
            <form onSubmit={requestOtp}>
              <label className="field"><span>Admin email</span>
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in code'}</button>
            </form>
          ) : (
            <form onSubmit={verifyOtp}>
              <label className="field"><span>One-time code</span>
                <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and sign in'}</button>
              <button className="btn" type="button" onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}>Use another email</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="admin-session-bar">
        <span className="admin-session-email" title={admin.email}>{admin.email}</span>
        <div className="admin-session-actions">
          <button className="btn btn-sm" onClick={async () => {
            setError('');
            try { await loadAdmins(); setShowAdmins((open) => !open); } catch (e) { setError(e.message); }
          }}>Manage admins</button>
          <button className="btn btn-sm" onClick={logout}>Sign out</button>
        </div>
      </div>
      {error && <div className="error admin-auth-message" role="alert">{error}</div>}
      {message && <div role="status" className="admin-auth-message">{message}</div>}
      {showAdmins && (
        <section className="card admin-users-panel">
          <h2>Authorized admins</h2>
          <form onSubmit={addAdmin} className="form-grid">
            <label className="field"><span>Name</span><input value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} /></label>
            <label className="field"><span>Email *</span><input type="email" required value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} /></label>
            <button type="submit" className="btn btn-primary">Add admin</button>
          </form>
          <ul>{admins.map((item) => <li key={item.id}>{item.display_name} — {item.email} {item.active ? '' : '(disabled)'}</li>)}</ul>
        </section>
      )}
      {children}
    </>
  );
}
