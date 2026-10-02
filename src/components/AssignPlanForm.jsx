import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.jsx';
import { api } from '../config.js';

export function AssignPlanForm({ imei, onClose, onSuccess, toast }) {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/api/plans').then(setPlans).catch(() => setPlans([])); }, []);
  useEffect(() => {
    if (!planId) { setSelectedPlan(null); return; }
    api(`/api/plans/${planId}`).then(setSelectedPlan).catch(() => setSelectedPlan(null));
  }, [planId]);

  async function submit(e) {
    e.preventDefault();
    if (!planId) return toast('Select a plan', 'error');
    setBusy(true);
    try {
      const r = await api('/api/assign-plan', { method: 'POST', body: JSON.stringify({ imei, plan_id: Number(planId), start_date: startDate }) });
      toast(`Plan assigned — ${r.installments_created} payments scheduled`, 'success');
      onSuccess(); onClose();
    } catch (e) { toast('Failed: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title={`Assign Plan — ${imei}`} onClose={onClose} width={700}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Select Plan *</span>
          <select value={planId} onChange={e => setPlanId(e.target.value)} required>
            <option value="">— Choose a plan —</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>
                {p.plan_name} — UGX {Number(p.total_amount_ugx).toLocaleString()} · {p.installment_count} × {p.frequency || 'monthly'}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Start Date</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </label>

        {selectedPlan && (
          <div className="plan-preview">
            <h4 style={{marginTop: 0}}>Schedule Preview</h4>
            <table style={{fontSize: 13}}>
              <thead><tr><th>#</th><th>Days</th><th>Amount</th><th>Due Date</th><th>Label</th></tr></thead>
              <tbody>
                {selectedPlan.installments?.map((inst, idx) => {
                  const d = new Date(startDate);
                  d.setDate(d.getDate() + Number(inst.offset_days));
                  return (
                    <tr key={idx}>
                      <td>{inst.label === 'Deposit' ? 'D' : idx + 1}</td>
                      <td>+{inst.offset_days}</td>
                      <td>{Number(inst.amount_ugx).toLocaleString()}</td>
                      <td>{d.toISOString().slice(0, 10)}</td>
                      <td>{inst.label || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Assigning…' : 'Assign Plan'}</button>
        </div>
      </form>
    </Modal>
  );
}
