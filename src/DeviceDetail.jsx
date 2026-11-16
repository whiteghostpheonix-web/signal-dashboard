import React, { useEffect, useState } from 'react';
import { Modal } from './components/Modal.jsx';
import { PaymentForm } from './components/PaymentForm.jsx';
import { api } from './config.js';

export default function DeviceDetail({ imei, onClose, toast }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [whitelistText, setWhitelistText] = useState('com.whatsapp\ncom.whatsapp.w4b\ncom.android.dialer\ncom.google.android.dialer\ncom.android.phone\ncom.android.contacts');
  const [savingWhitelist, setSavingWhitelist] = useState(false);

  async function load() {
    try { const result = await api(`/api/dashboard/devices/${imei}`); setData(result); const packages = Array.isArray(result.device.allowed_apps) ? result.device.allowed_apps : (() => { try { return JSON.parse(result.device.allowed_apps || '[]'); } catch { return []; } })(); setWhitelistText(packages.join('\n')); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [imei]);

  async function saveWhitelist() {
    const packages = [...new Set(whitelistText.split(/\r?\n/).map(x => x.trim()).filter(Boolean))];
    setSavingWhitelist(true);
    try {
      await api(`/api/devices/${encodeURIComponent(imei)}/whitelist`, { method: 'PUT', body: JSON.stringify({ packages }) });
      toast('Approved apps saved. The device will refresh its policy at next heartbeat.', 'success');
      await load();
    } catch (e) { toast(e.message || 'Could not save approved apps', 'error'); }
    finally { setSavingWhitelist(false); }
  }


  return (
    <Modal title={`Device ${imei}`} onClose={onClose} width={800}>
      {error && <div className="error">{error}</div>}
      {!data && <div className="loading">Loading…</div>}
      {data && (
        <>
          <div className="card" style={{marginBottom: 16}}>
            <div className="label">Customer</div>
            <div style={{fontSize: 16, marginTop: 4}}>{data.device.customer_name || '—'}</div>
            <div style={{color: '#999', fontSize: 13}}>{data.device.customer_phone}</div>
            <div className="label" style={{marginTop: 12}}>Status</div>
            <span className={`badge ${data.device.status}`}>{data.device.status}</span>
            <div className="device-detail-meta">
              <div><span>Customer payment code</span><b>{data.device.payment_code || '—'}</b></div>
              <div><span>Assigned retailer</span><b>{data.device.reseller_email || 'Not assigned'}</b></div>
              <div><span>Registered</span><b>{data.device.created_at || '—'}</b></div>
            </div>
          </div>

          <div className="card" style={{marginBottom: 18}}>
            <h3 style={{fontSize: 15, color: '#666', marginTop: 0}}>Approved apps (device whitelist)</h3>
            <p style={{fontSize: 12, color: '#888'}}>One Android package ID per line. These apps are allowed in managed lock-task mode on supported Device Owner devices.</p>
            <textarea rows={5} value={whitelistText} onChange={e => setWhitelistText(e.target.value)} style={{width: '100%', fontFamily: 'monospace', fontSize: 12, padding: 10, borderRadius: 8, border: '1px solid #ccd4df'}} />
            <button className="btn btn-primary btn-sm" disabled={savingWhitelist} onClick={saveWhitelist}>{savingWhitelist ? 'Saving…' : 'Save approved apps'}</button>
          </div>

          <h3 style={{fontSize: 15, color: '#666'}}>Payment Schedule</h3>
          <table style={{fontSize: 13}}>
            <thead><tr><th>#</th><th>Due Date</th><th>Due</th><th>Paid</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.schedules.map(s => (
                <tr key={s.id}>
                  <td>{s.installment_number}</td><td>{s.due_date}</td>
                  <td>{Number(s.amount_due_ugx).toLocaleString()}</td>
                  <td>{Number(s.amount_paid_ugx || 0).toLocaleString()}</td>
                  <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                  <td>{s.status !== 'paid' && <button className="btn btn-primary btn-sm" onClick={() => setPayFor(s)}>Pay</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{fontSize: 15, color: '#666', marginTop: 24}}>Recent Commands</h3>
          <table style={{fontSize: 13}}>
            <thead><tr><th>Type</th><th>Reason</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {data.commands.map(c => (
                <tr key={c.id}><td><strong>{c.command}</strong></td><td>{c.reason}</td><td>{c.status}</td><td>{c.created_at}</td></tr>
              ))}
            </tbody>
          </table>

          <h3 style={{fontSize: 15, color: '#666', marginTop: 24}}>Recent Payments</h3>
          <table style={{fontSize: 13}}>
            <thead><tr><th>Amount</th><th>Method</th><th>Reference</th><th>When</th></tr></thead>
            <tbody>
              {data.transactions.map(t => (
                <tr key={t.id}><td>{Number(t.amount_ugx).toLocaleString()}</td><td>{t.payment_method}</td>
                <td style={{fontFamily: 'monospace', fontSize: 11}}>{t.reference || '—'}</td><td>{t.paid_at}</td></tr>
              ))}
            </tbody>
          </table>

          {payFor && <PaymentForm schedule={payFor} onClose={() => setPayFor(null)} onSuccess={load} toast={toast} />}
        </>
      )}
    </Modal>
  );
}
