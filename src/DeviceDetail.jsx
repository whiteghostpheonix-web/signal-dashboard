import React, { useEffect, useState } from 'react';
import { Modal } from './components/Modal.jsx';
import { PaymentForm } from './components/PaymentForm.jsx';
import { api } from './config.js';

export default function DeviceDetail({ imei, onClose, toast }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [payFor, setPayFor] = useState(null);

  async function load() {
    try { setData(await api(`/api/dashboard/devices/${imei}`)); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [imei]);

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
