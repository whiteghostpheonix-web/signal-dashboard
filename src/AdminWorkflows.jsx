import React, { useCallback, useEffect, useState } from 'react';
import { api } from './config.js';

export default function AdminWorkflows({ view, toast = () => {} }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ reseller_id: '', payment_reference: '', payment_amount_ugx: '', rate_percent: '0', fixed_amount_ugx: '0' });

  const endpoint = view === 'applications' ? '/api/admin/customer-applications'
    : view === 'commissions' ? '/api/admin/commissions'
    : '/api/admin/withdrawals';
  const key = view === 'applications' ? 'applications' : view === 'commissions' ? 'commissions' : 'withdrawals';

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api(endpoint);
      setRows(result[key] || []);
    } catch (error) {
      toast('Could not load ' + view + ': ' + error.message, 'error');
    } finally { setBusy(false); }
  }, [endpoint, key, toast, view]);

  useEffect(() => { load(); }, [load]);

  async function decide(path, decision, requireReason = false) {
    const reason = decision === 'reject' && requireReason ? (window.prompt('Reason for rejection?') || '') : '';
    if (decision === 'reject' && requireReason && !reason.trim()) return;
    try {
      await api(path, { method: 'POST', body: JSON.stringify({ decision, reason }) });
      toast('Record ' + decision + 'd', 'success');
      await load();
    } catch (error) { toast('Action failed: ' + error.message, 'error'); }
  }

  async function recordCommission(event) {
    event.preventDefault();
    try {
      await api('/api/admin/commissions/record', { method: 'POST', body: JSON.stringify({
        reseller_id: form.reseller_id, payment_reference: form.payment_reference,
        payment_amount_ugx: Number(form.payment_amount_ugx),
      }) });
      toast('Commission recorded', 'success');
      setForm(v => ({ ...v, payment_reference: '', payment_amount_ugx: '' }));
      await load();
    } catch (error) { toast('Could not record commission: ' + error.message, 'error'); }
  }

  async function saveSettings(event) {
    event.preventDefault();
    try {
      await api('/api/admin/commission-settings', { method: 'POST', body: JSON.stringify({
        reseller_id: form.reseller_id, rate_percent: Number(form.rate_percent),
        fixed_amount_ugx: Number(form.fixed_amount_ugx), applies_to: 'received_payment', active: true,
      }) });
      toast('Commission settings saved', 'success');
    } catch (error) { toast('Could not save settings: ' + error.message, 'error'); }
  }

  const money = value => 'UGX ' + Number(value || 0).toLocaleString();
  return <section className="card" style={{ marginTop: 16, padding: 20 }}>
    <div className="header-actions" style={{ justifyContent: 'space-between' }}>
      <h2>{view === 'applications' ? 'Customer Applications' : view === 'commissions' ? 'Reseller Commissions' : 'Withdrawals'}</h2>
      <button className="btn" onClick={load} disabled={busy}>Refresh</button>
    </div>
    {view === 'applications' && <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Reseller</th><th>Deposit</th><th>Status</th><th>Review</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td>{row.customer_name}</td><td>{row.customer_phone}</td><td>{row.reseller_id || '—'}</td><td>{money(row.deposit_amount_ugx)}</td><td>{row.status}</td><td>{row.status === 'pending' ? <><button className="btn btn-sm btn-primary" onClick={() => decide('/api/admin/customer-applications/' + encodeURIComponent(row.id) + '/decision', 'approve', true)}>Approve</button> <button className="btn btn-sm" onClick={() => decide('/api/admin/customer-applications/' + encodeURIComponent(row.id) + '/decision', 'reject', true)}>Reject</button></> : 'Reviewed'}</td></tr>)}
      {!rows.length && <tr><td colSpan="6">{busy ? 'Loading…' : 'No customer applications found.'}</td></tr>}
    </tbody></table></div>}
    {view === 'commissions' && <>
      <form className="form-grid" onSubmit={saveSettings}>
        <label className="field"><span>Reseller ID</span><input required value={form.reseller_id} onChange={e => setForm(v => ({...v,reseller_id:e.target.value}))}/></label>
        <label className="field"><span>Commission rate (%)</span><input type="number" min="0" max="100" step="0.01" value={form.rate_percent} onChange={e => setForm(v => ({...v,rate_percent:e.target.value}))}/></label>
        <label className="field"><span>Fixed commission (UGX)</span><input type="number" min="0" value={form.fixed_amount_ugx} onChange={e => setForm(v => ({...v,fixed_amount_ugx:e.target.value}))}/></label>
        <button className="btn btn-primary" type="submit">Save commission settings</button>
      </form>
      <form className="form-grid" onSubmit={recordCommission} style={{ marginTop: 16 }}>
        <label className="field"><span>Payment reference</span><input required value={form.payment_reference} onChange={e => setForm(v => ({...v,payment_reference:e.target.value}))}/></label>
        <label className="field"><span>Payment amount (UGX)</span><input required type="number" min="1" value={form.payment_amount_ugx} onChange={e => setForm(v => ({...v,payment_amount_ugx:e.target.value}))}/></label>
        <button className="btn" type="submit">Record commission</button>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Reseller</th><th>Payment reference</th><th>Payment</th><th>Commission</th><th>Status</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}><td>{row.reseller_id}</td><td>{row.payment_reference}</td><td>{money(row.payment_amount_ugx)}</td><td>{money(row.commission_amount_ugx)}</td><td>{row.status}</td></tr>)}
        {!rows.length && <tr><td colSpan="5">{busy ? 'Loading…' : 'No commissions found.'}</td></tr>}
      </tbody></table></div>
    </>}
    {view === 'withdrawals' && <div className="table-wrap"><table><thead><tr><th>Reseller</th><th>Amount</th><th>Payout method</th><th>Requested</th><th>Status</th><th>Review</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td>{row.reseller_id}</td><td>{money(row.amount_ugx)}</td><td>{row.payout_method || '—'}</td><td>{row.requested_at}</td><td>{row.status}</td><td>{row.status === 'pending' ? <><button className="btn btn-sm btn-primary" onClick={() => decide('/api/admin/withdrawals/' + encodeURIComponent(row.id) + '/decision', 'approve')}>Approve</button> <button className="btn btn-sm" onClick={() => decide('/api/admin/withdrawals/' + encodeURIComponent(row.id) + '/decision', 'reject', true)}>Reject</button></> : 'Reviewed'}</td></tr>)}
      {!rows.length && <tr><td colSpan="6">{busy ? 'Loading…' : 'No withdrawals found.'}</td></tr>}
    </tbody></table></div>}
  </section>;
}
