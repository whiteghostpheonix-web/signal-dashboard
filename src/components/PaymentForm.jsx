import React, { useState } from 'react';
import { Modal } from './Modal.jsx';
import { api } from '../config.js';

export function PaymentForm({ schedule, onClose, onSuccess, toast }) {
  const remaining = schedule.amount_due_ugx - (schedule.amount_paid_ugx || 0);
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState('MTN MoMo');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/api/payments', { method: 'POST', body: JSON.stringify({
        schedule_id: schedule.id, amount_ugx: Number(amount),
        payment_method: method, reference: reference || `manual_${Date.now()}`,
      })});
      toast(r.device_unlocked ? '✅ Payment recorded — device unlocked' : '✅ Payment recorded', 'success');
      onSuccess(); onClose();
    } catch (e) { toast('Failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Record Payment — Installment ${schedule.installment_number}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="summary">
          <div><strong>Due:</strong> UGX {Number(schedule.amount_due_ugx).toLocaleString()}</div>
          <div><strong>Already paid:</strong> UGX {Number(schedule.amount_paid_ugx || 0).toLocaleString()}</div>
          <div><strong>Remaining:</strong> UGX {Number(remaining).toLocaleString()}</div>
        </div>
        <label className="field"><span>Amount Received (UGX)</span>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="1" required /></label>
        <label className="field"><span>Method</span>
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option>MTN MoMo</option><option>Airtel Money</option><option>Cash</option><option>Bank Transfer</option>
          </select></label>
        <label className="field"><span>Reference (transaction ID)</span>
          <input value={reference} onChange={e => setReference(e.target.value)} placeholder="optional" /></label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Recording…' : 'Record Payment'}</button>
        </div>
      </form>
    </Modal>
  );
}
