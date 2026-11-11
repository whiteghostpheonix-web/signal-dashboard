import React, { useCallback, useEffect, useState } from 'react';
import { api } from './config.js';

const ugx = n => `UGX ${Number(n || 0).toLocaleString('en-UG')}`;
const blank = { id: '', device_model: '', device_type: 'Smartphone', selling_price_ugx: '', plan_ids: [] };

export default function RetailerManagement({ toast = () => {} }) {
  const [catalog, setCatalog] = useState({ devices: [], device_plans: [] });
  const [plans, setPlans] = useState([]);
  const [rateData, setRateData] = useState({ rates: [], retailers: [] });
  const [applications, setApplications] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [earnedCommissions, setEarnedCommissions] = useState([]);
  const [form, setForm] = useState(blank);
  const [rate, setRate] = useState({ retailer_email: '', catalog_device_id: '', plan_id: '', rate_percent: '' });
  const [imei, setImei] = useState({});
  const [reason, setReason] = useState({});
  const [busy, setBusy] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [kycImages, setKycImages] = useState({});

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, p, r, a, w, cm] = await Promise.all([
        api('/api/admin/retailer/catalog'), api('/api/admin/retailer/plans'),
        api('/api/admin/retailer/commission-rates'), api('/api/admin/retailer/applications'),
        api('/api/admin/retailer/withdrawals'), api('/api/admin/retailer/commissions'),
      ]);
      setCatalog(c); setPlans(p.plans || []); setRateData(r); setApplications(a.applications || []); setWithdrawals(w.withdrawals || []); setEarnedCommissions(cm.commissions || []);
    } catch (e) { toast(`Retailer management could not load: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  function editDevice(d) {
    setForm({ id: d.id, device_model: d.device_model, device_type: d.device_type, selling_price_ugx: String(d.selling_price_ugx), plan_ids: catalog.device_plans.filter(x => x.catalog_device_id === d.id && x.visible).map(x => String(x.plan_id)) });
  }
  async function saveDevice(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api('/api/admin/retailer/catalog', { method: 'POST', body: JSON.stringify({ ...form, id: Number(form.id) || undefined, selling_price_ugx: Number(form.selling_price_ugx), plan_ids: form.plan_ids.map(Number) }) });
      toast('Retailer device and visible plans saved.', 'success'); setForm(blank); await load();
    } catch (err) { toast(`Could not save device: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  }
  async function saveRate(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api('/api/admin/retailer/commission-rates', { method: 'POST', body: JSON.stringify({ ...rate, catalog_device_id: Number(rate.catalog_device_id), plan_id: Number(rate.plan_id), rate_percent: Number(rate.rate_percent) }) });
      toast('Device/plan commission percentage saved.', 'success'); await load();
    } catch (err) { toast(`Could not save commission rate: ${err.message}`, 'error'); }
    finally { setBusy(false); }
  }
  async function decide(id, decision) {
    if (decision === 'reject' && !String(reason[id] || '').trim()) { toast('Enter a rejection reason first.', 'error'); return; }
    setBusy(true);
    try { await api(`/api/admin/retailer/applications/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason: reason[id] || '' }) }); toast(`Retailer application ${decision}ed.`, 'success'); await load(); }
    catch (e) { toast(`Application decision failed: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  }
  async function register(id) {
    const value = String(imei[id] || '').trim(); if (!value) { toast('Enter the IMEI to register this device.', 'error'); return; }
    setBusy(true);
    try { const result = await api(`/api/admin/retailer/applications/${encodeURIComponent(id)}/register`, { method: 'POST', body: JSON.stringify({ imei: value }) }); toast(`Device registered. Retailer commission: ${ugx(result.commission_amount_ugx)}.`, 'success'); await load(); }
    catch (e) { toast(`Device registration failed: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  }
  async function viewKyc(app) {
    setSelectedApp(app); setKycImages({});
    const paths = [];
    Object.entries(app.customer?.media || {}).forEach(([label, key]) => paths.push([label, key]));
    (app.guarantors || []).forEach((g, i) => Object.entries(g.media || {}).forEach(([label, key]) => paths.push([`Guarantor ${i + 1} ${label}`, key])));
    try {
      const entries = await Promise.all(paths.map(async ([label, key]) => [label, (await api(`/api/admin/retailer/media?application_id=${encodeURIComponent(app.id)}&key=${encodeURIComponent(key)}`)).data_url]));
      setKycImages(Object.fromEntries(entries));
    } catch (e) { toast(`Could not load KYC images: ${e.message}`, 'error'); }
  }
  async function withdrawal(id, decision) {
    const payout_reference = decision === 'paid' ? prompt('Enter payout reference:') : '';
    if (decision === 'paid' && !payout_reference) return;
    setBusy(true);
    try { await api(`/api/admin/retailer/withdrawals/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision, payout_reference }) }); toast(`Withdrawal ${decision}.`, 'success'); await load(); }
    catch (e) { toast(`Withdrawal update failed: ${e.message}`, 'error'); }
    finally { setBusy(false); }
  }

  return <section className="workflow-page">
    <div className="workflow-heading"><div><p className="workflow-eyebrow">Retailer portal controls</p><h2>Retailer management</h2><p className="muted-workflow">Set selling prices, choose retailer-visible plans, set commission per retailer/device/plan, review applications and process withdrawals.</p></div><button className="btn" onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button></div>
    <div className="workflow-columns">
      <form className="card workflow-form" onSubmit={saveDevice}><h3>Device catalogue and plan visibility</h3>
        <label className="field"><span>Device model</span><input required value={form.device_model} onChange={e => setForm(v => ({ ...v, device_model: e.target.value }))} /></label>
        <label className="field"><span>Device type</span><input value={form.device_type} onChange={e => setForm(v => ({ ...v, device_type: e.target.value }))} /></label>
        <label className="field"><span>Selling price (UGX)</span><input type="number" min="1" step="1" required value={form.selling_price_ugx} onChange={e => setForm(v => ({ ...v, selling_price_ugx: e.target.value }))} /></label>
        <div className="field"><span>Plans visible for this device</span>{plans.map(p => <label key={p.id} className="workflow-check"><input type="checkbox" checked={form.plan_ids.includes(String(p.id))} onChange={e => setForm(v => ({ ...v, plan_ids: e.target.checked ? [...v.plan_ids, String(p.id)] : v.plan_ids.filter(x => x !== String(p.id)) }))} />{p.plan_name} — {ugx(p.total_amount_ugx)}</label>)}</div>
        <button className="btn btn-primary" disabled={busy || !form.plan_ids.length}>{form.id ? 'Update retailer device' : 'Add retailer device'}</button><button type="button" className="btn" onClick={() => setForm(blank)}>Clear form</button>
      </form>
      <form className="card workflow-form" onSubmit={saveRate}><h3>Commission rate per retailer, device and plan</h3>
        <label className="field"><span>Registered retailer</span><select required value={rate.retailer_email} onChange={e => setRate(v => ({ ...v, retailer_email: e.target.value }))}><option value="">Choose retailer</option>{rateData.retailers.map(r => <option key={r.email} value={r.email}>{r.name || r.email} — {r.email}</option>)}</select></label>
        <label className="field"><span>Device</span><select required value={rate.catalog_device_id} onChange={e => setRate(v => ({ ...v, catalog_device_id: e.target.value, plan_id: '' }))}><option value="">Choose device</option>{catalog.devices.map(d => <option key={d.id} value={d.id}>{d.device_model} — {ugx(d.selling_price_ugx)}</option>)}</select></label>
        <label className="field"><span>Visible plan</span><select required value={rate.plan_id} onChange={e => setRate(v => ({ ...v, plan_id: e.target.value }))}><option value="">Choose plan</option>{catalog.device_plans.filter(x => x.visible && String(x.catalog_device_id) === String(rate.catalog_device_id)).map(x => { const p = plans.find(y => y.id === x.plan_id); return p ? <option key={p.id} value={p.id}>{p.plan_name}</option> : null; })}</select></label>
        <label className="field"><span>Commission percentage (%)</span><input type="number" min="0" max="100" step="0.01" required value={rate.rate_percent} onChange={e => setRate(v => ({ ...v, rate_percent: e.target.value }))} /></label>
        <button className="btn btn-primary" disabled={busy || !rate.retailer_email || !rate.catalog_device_id || !rate.plan_id}>Save commission rate</button>
        <div className="workflow-settings-list"><h4>Saved commission rates</h4>{rateData.rates.map(r => <div key={`${r.retailer_email}-${r.catalog_device_id}-${r.plan_id}`}><span>{r.retailer_email}<br/>Device #{r.catalog_device_id} · Plan #{r.plan_id}</span><b>{r.rate_percent}%</b></div>)}{!rateData.rates.length && <p className="muted-workflow">No device/plan rates configured yet.</p>}</div>
      </form>
    </div>
    <div className="workflow-heading workflow-subheading"><div><h3>Retailer customer applications</h3><p className="muted-workflow">Approve or reject applications. Commission is earned only after device registration.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Customer / retailer</th><th>Device / IMEI</th><th>Plan</th><th>Price</th><th>Estimated commission</th><th>Status</th><th>Admin action</th></tr></thead><tbody>
      {applications.map(a => <tr key={a.id}><td>{a.customer?.full_name}<br/><small>{a.customer?.phone}<br/>{a.retailer_email}</small></td><td>{a.device?.device_model}<br/><small>{a.device?.imei}</small></td><td>{plans.find(p => p.id === a.plan_id)?.plan_name || `Plan #${a.plan_id}`}</td><td>{ugx(a.selling_price_ugx)}</td><td>{ugx(a.estimated_commission_ugx)} ({a.commission_rate_percent}%)</td><td><span className={`badge ${a.status}`}>{a.status}</span></td><td><button className="btn btn-sm" onClick={() => viewKyc(a)}>View KYC</button>{a.status === 'pending' ? <div className="action-cell"><input aria-label="Rejection reason" placeholder="Reason if rejecting" value={reason[a.id] || ''} onChange={e => setReason(v => ({ ...v, [a.id]: e.target.value }))} /><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(a.id, 'approve')}>Approve</button><button className="btn btn-sm" disabled={busy} onClick={() => decide(a.id, 'reject')}>Reject</button></div> : a.status === 'approved' ? <div className="action-cell"><input aria-label="Registered device IMEI" placeholder="IMEI to register" value={imei[a.id] || a.device?.imei || ''} onChange={e => setImei(v => ({ ...v, [a.id]: e.target.value }))} /><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => register(a.id)}>Register device + earn commission</button></div> : a.status === 'registered' ? <small>Registered by {a.registered_by || 'admin'} · {a.registered_at}</small> : <small>{a.decision_reason || 'Rejected'}</small>}</td></tr>)}
      {!applications.length && <tr><td colSpan="7" className="workflow-empty">No retailer applications yet.</td></tr>}
    </tbody></table></div>
    {selectedApp && <div className="modal-bg" onClick={() => setSelectedApp(null)}><section className="modal workflow-detail" role="dialog" aria-modal="true" aria-label="Retailer KYC review" onClick={e => e.stopPropagation()}><div className="modal-header"><div><h2>{selectedApp.customer?.full_name || 'Customer KYC'}</h2><span className={`badge ${selectedApp.status}`}>{selectedApp.status}</span></div><button className="close" onClick={() => setSelectedApp(null)}>×</button></div><div className="modal-body"><p><b>Retailer:</b> {selectedApp.retailer_email}</p><p><b>NIN:</b> {selectedApp.customer?.nin || '—'} · <b>Phone:</b> {selectedApp.customer?.phone || '—'}</p><p><b>Address:</b> {selectedApp.customer?.address || '—'} · <b>Occupation:</b> {selectedApp.customer?.occupation || '—'}</p><h3>Customer and guarantor camera captures</h3><div className="workflow-media">{Object.entries(kycImages).map(([label, src]) => <a key={label} href={src} target="_blank" rel="noreferrer"><img src={src} alt={label}/><span>{label.replaceAll('_',' ')}</span></a>)}{!Object.keys(kycImages).length && <p className="muted-workflow">No KYC images were attached to this application.</p>}</div><h3>Guarantors</h3><pre>{JSON.stringify(selectedApp.guarantors || [], null, 2)}</pre><h3>Device and plan</h3><pre>{JSON.stringify(selectedApp.device || {}, null, 2)}</pre></div></section></div>}
    <div className="workflow-heading workflow-subheading"><div><h3>Earned device-registration commissions</h3><p className="muted-workflow">Commission snapshots are created only when an approved device is registered.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Retailer</th><th>Device</th><th>IMEI</th><th>Plan</th><th>Selling price</th><th>Rate</th><th>Earned</th><th>Status</th></tr></thead><tbody>{earnedCommissions.map(c => <tr key={c.id}><td>{c.retailer_email}</td><td>{c.device_model}</td><td>{c.device_imei}</td><td>{c.plan_name}</td><td>{ugx(c.device_selling_price_ugx)}</td><td>{c.rate_percent}%</td><td><b>{ugx(c.commission_amount_ugx)}</b></td><td>{c.status}</td></tr>)}{!earnedCommissions.length && <tr><td colSpan="8" className="workflow-empty">No commissions earned from device registrations yet.</td></tr>}</tbody></table></div>
    <div className="workflow-heading workflow-subheading"><div><h3>Retailer withdrawal requests</h3></div></div>
    <div className="table-wrap"><table><thead><tr><th>Retailer</th><th>Amount</th><th>Status</th><th>Reference</th><th>Action</th></tr></thead><tbody>{withdrawals.map(w => <tr key={w.id}><td>{w.retailer_email}</td><td>{ugx(w.amount_ugx)}</td><td>{w.status}</td><td>{w.payout_reference || '—'}</td><td>{['pending','approved'].includes(w.status) ? <div className="action-cell"><button className="btn btn-sm" disabled={busy} onClick={() => withdrawal(w.id, 'approve')}>Approve</button><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => withdrawal(w.id, 'paid')}>Mark paid</button><button className="btn btn-sm" disabled={busy} onClick={() => withdrawal(w.id, 'reject')}>Reject</button></div> : '—'}</td></tr>)}{!withdrawals.length && <tr><td colSpan="5" className="workflow-empty">No withdrawal requests.</td></tr>}</tbody></table></div>
  </section>;
}
