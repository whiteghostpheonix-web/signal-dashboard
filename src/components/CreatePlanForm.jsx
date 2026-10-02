import React, { useState } from 'react';
import { Modal } from './Modal.jsx';
import { api } from '../config.js';

const PERIOD_TYPES = [
  { value: 'daily',   label: 'Day' },
  { value: 'weekly',  label: 'Week' },
  { value: 'monthly', label: 'Month' },
];

export function CreatePlanForm({ onClose, onSuccess, toast }) {
  const [planName, setPlanName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [amountPerPeriod, setAmountPerPeriod] = useState(1900);
  const [periodCount, setPeriodCount] = useState(180);
  const [grace, setGrace] = useState(3);
  const [notes, setNotes] = useState('');
  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(75000);
  const [depositDueDays, setDepositDueDays] = useState(0);
  const [busy, setBusy] = useState(false);

  const unit = PERIOD_TYPES.find(p => p.value === frequency)?.label || 'Day';
  const installmentsTotal = Number(amountPerPeriod) * Number(periodCount);
  const depositTotal = hasDeposit ? Number(depositAmount) : 0;
  const grandTotal = installmentsTotal + depositTotal;

  async function submit(e) {
    e.preventDefault();
    if (!planName) return toast('Plan name required', 'error');
    const count = Number(periodCount);
    if (count < 1 || count > 2000) return toast('Period count must be 1-2000', 'error');
    setBusy(true);
    try {
      const r = await api('/api/plans', {
        method: 'POST',
        body: JSON.stringify({
          plan_name: planName,
          frequency,
          amount_per_period: Number(amountPerPeriod),
          period_count: count,
          grace_period_days: Number(grace),
          notes,
          has_deposit: hasDeposit,
          deposit_amount: hasDeposit ? Number(depositAmount) : 0,
          deposit_due_days: hasDeposit ? Number(depositDueDays) : 0,
        }),
      });
      toast('Plan created — ' + r.period_count + ' installments', 'success');
      onSuccess(); onClose();
    } catch (e) { toast('Failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Create Payment Plan" onClose={onClose} width={720}>
      <form onSubmit={submit}>
        <label className="field"><span>Plan Name *</span>
          <input value={planName} onChange={e => setPlanName(e.target.value)}
            placeholder="e.g. Smartphone 180 days @ 1900/day" required /></label>

        <div className="form-grid">
          <label className="field"><span>Payment Frequency *</span>
            <select value={frequency} onChange={e => setFrequency(e.target.value)}>
              {PERIOD_TYPES.map(p => (<option key={p.value} value={p.value}>Per {p.label}</option>))}
            </select></label>
          <label className="field"><span>Grace Period (days)</span>
            <input type="number" min="0" value={grace} onChange={e => setGrace(e.target.value)} /></label>
        </div>

        <div className="form-grid">
          <label className="field"><span>Amount per {unit} (UGX) *</span>
            <input type="number" min="1" value={amountPerPeriod}
              onChange={e => setAmountPerPeriod(e.target.value)} required /></label>
          <label className="field"><span>Number of {unit}s *</span>
            <input type="number" min="1" max="2000" value={periodCount}
              onChange={e => setPeriodCount(e.target.value)} required /></label>
        </div>

        <div className="summary" style={{background: '#f0f6ff', padding: 14}}>
          <div><strong>{periodCount} {unit}s × {Number(amountPerPeriod).toLocaleString()} UGX = {Number(installmentsTotal).toLocaleString()} UGX</strong></div>
        </div>

        <div className="card" style={{background: '#fff8e1', marginTop: 12, marginBottom: 16, padding: 16}}>
          <label style={{display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: hasDeposit ? 12 : 0}}>
            <input type="checkbox" checked={hasDeposit} onChange={e => setHasDeposit(e.target.checked)} />
            <strong>Also require initial deposit</strong>
          </label>
          {hasDeposit && (
            <div className="form-grid" style={{marginTop: 8}}>
              <label className="field" style={{marginBottom: 0}}>
                <span>Deposit Amount (UGX)</span>
                <input type="number" min="0" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              </label>
              <label className="field" style={{marginBottom: 0}}>
                <span>Deposit Due in Days (0 = today)</span>
                <input type="number" min="0" value={depositDueDays} onChange={e => setDepositDueDays(e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="summary" style={{background: '#e7f5ff', border: '2px solid #0F62FE', padding: 16}}>
          <div style={{fontSize: 18}}><strong>Grand Total: UGX {Number(grandTotal).toLocaleString()}</strong></div>
        </div>

        <label className="field"><span>Notes (optional)</span>
          <input value={notes} onChange={e => setNotes(e.target.value)} /></label>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create Plan'}</button>
        </div>
      </form>
    </Modal>
  );
}
