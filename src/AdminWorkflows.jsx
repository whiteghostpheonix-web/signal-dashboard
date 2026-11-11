import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './config.js';

const money = value => `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
const parseJson = value => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
};
const pretty = value => {
  const data = parseJson(value);
  if (Array.isArray(data)) return data.map((item, i) => `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : item}`).join('\n');
  return Object.entries(data).map(([key, item]) => `${key.replace(/_/g, ' ')}: ${typeof item === 'object' ? JSON.stringify(item) : item ?? '—'}`).join('\n');
};

function MediaGallery({ value, title }) {
  const data = parseJson(value);
  const items = [];
  const visit = (node, label = title) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (/^(data:image\/|https?:\/\/)/i.test(node)) items.push({ label, src: node });
      return;
    }
    if (Array.isArray(node)) node.forEach((item, i) => visit(item, `${label} ${i + 1}`));
    else if (typeof node === 'object') Object.entries(node).forEach(([key, item]) => visit(item, key.replace(/[_-]/g, ' ')));
  };
  visit(data);
  if (!items.length) return <p className="muted-workflow">No uploaded images attached.</p>;
  return <div className="workflow-media">{items.map((item, i) => <a key={`${item.src.slice(0, 30)}-${i}`} href={item.src} target="_blank" rel="noreferrer"><img src={item.src} alt={item.label} /><span>{item.label}</span></a>)}</div>;
}

export default function AdminWorkflows({ view, toast = () => {} }) {
  const [applications, setApplications] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [settings, setSettings] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingForm, setSettingForm] = useState({ reseller_id: '', rate_percent: '0', fixed_amount_ugx: '0', applies_to: 'received_payment', active: true });
  const [recordForm, setRecordForm] = useState({ reseller_id: '', payment_reference: '', payment_amount_ugx: '', customer_application_id: '' });

  const loadApplications = useCallback(async () => {
    const query = filter ? `?status=${encodeURIComponent(filter)}&limit=100` : '?limit=100';
    const result = await api(`/api/admin/customer-applications${query}`);
    setApplications(result.applications || []);
  }, [filter]);

  const loadCommissions = useCallback(async () => {
    const [commissionResult, settingsResult, resellerResult] = await Promise.all([
      api('/api/admin/commissions?limit=100'),
      api('/api/admin/commission-settings'),
      api('/api/resellers'),
    ]);
    setCommissions(commissionResult.commissions || []);
    setSettings(settingsResult.settings || []);
    setResellers(Array.isArray(resellerResult) ? resellerResult : []);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      if (view === 'applications') await loadApplications();
      else await loadCommissions();
    } catch (error) {
      toast(`Could not load ${view === 'applications' ? 'customer applications' : 'commissions'}: ${error.message}`, 'error');
    } finally { setBusy(false); }
  }, [view, loadApplications, loadCommissions, toast]);

  useEffect(() => { void load(); }, [load]);

  const filteredApplications = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter(row => !q || [row.customer_name, row.customer_phone, row.customer_email, row.reseller_id, row.nin].some(v => String(v || '').toLowerCase().includes(q)));
  }, [applications, search]);

  function chooseReseller(email) {
    const current = settings.find(item => item.reseller_id === email);
    setSettingForm({
      reseller_id: email,
      rate_percent: String(current?.rate_percent ?? 0),
      fixed_amount_ugx: String(current?.fixed_amount_ugx ?? 0),
      applies_to: current?.applies_to || 'received_payment',
      active: current ? Number(current.active) === 1 : true,
    });
    setRecordForm(value => ({ ...value, reseller_id: email }));
  }

  async function decide(decision) {
    if (!selected) return;
    if (decision === 'reject' && !decisionReason.trim()) {
      toast('Enter a reason before rejecting this application.', 'error');
      return;
    }
    setSaving(true);
    try {
      await api(`/api/admin/customer-applications/${encodeURIComponent(selected.id)}/decision`, {
        method: 'POST', body: JSON.stringify({ decision, reason: decisionReason.trim() }),
      });
      toast(`Application ${decision === 'approve' ? 'approved' : 'rejected'}.`, 'success');
      setSelected(null); setDecisionReason('');
      await loadApplications();
    } catch (error) { toast(`Could not ${decision} application: ${error.message}`, 'error'); }
    finally { setSaving(false); }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/commission-settings', { method: 'POST', body: JSON.stringify({
        ...settingForm,
        rate_percent: Number(settingForm.rate_percent),
        fixed_amount_ugx: Number(settingForm.fixed_amount_ugx),
      }) });
      toast('Commission settings saved.', 'success');
      await loadCommissions();
    } catch (error) { toast(`Could not save commission settings: ${error.message}`, 'error'); }
    finally { setSaving(false); }
  }

  async function recordCommission(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api('/api/admin/commissions/record', { method: 'POST', body: JSON.stringify({
        ...recordForm,
        payment_amount_ugx: Number(recordForm.payment_amount_ugx),
      }) });
      toast('Commission recorded.', 'success');
      setRecordForm(value => ({ ...value, payment_reference: '', payment_amount_ugx: '', customer_application_id: '' }));
      await loadCommissions();
    } catch (error) { toast(`Could not record commission: ${error.message}`, 'error'); }
    finally { setSaving(false); }
  }

  if (view === 'commissions') return <section className="workflow-page"><div className="workflow-heading"><div><p className="workflow-eyebrow">Historical records</p><h2>Legacy payment commissions</h2><p className="muted-workflow">Existing payment-based records are retained for history. New retailer commission is configured per device and plan in Retailer Management and earned only after device registration.</p></div><button className="btn" onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button></div><div className="table-wrap"><table><thead><tr><th>Retailer</th><th>Reference</th><th>Old payment amount</th><th>Rate</th><th>Recorded commission</th><th>Status</th><th>Date</th></tr></thead><tbody>{commissions.map(row => <tr key={row.id}><td>{row.reseller_id}</td><td>{row.payment_reference}</td><td>{money(row.payment_amount_ugx)}</td><td>{Number(row.rate_percent)}%</td><td>{money(row.commission_amount_ugx)}</td><td>{row.status}</td><td>{row.created_at}</td></tr>)}{!commissions.length && <tr><td colSpan="7" className="workflow-empty">No historical payment commission records.</td></tr>}</tbody></table></div></section>;

  const title = 'Customer Applications';
  return <section className="workflow-page">
    <div className="workflow-heading">
      <div><p className="workflow-eyebrow">Signal Electronics Admin</p><h2>{title}</h2><p className="muted-workflow">{view === 'applications' ? 'Review retailer-submitted customer onboarding, KYC, guarantor, device and financing details.' : 'Set retailer commission terms and review recorded commission amounts.'}</p></div>
      <button className="btn" onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
    </div>

    {view === 'applications' && <>
      <div className="filters workflow-filters">
        <input className="search" aria-label="Search applications" placeholder="Search customer, phone, retailer or NIN…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="btn" aria-label="Application status" value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">Pending review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="">All statuses</option></select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Retailer</th><th>Initial deposit</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody>
        {filteredApplications.map(row => <tr key={row.id}><td>{row.customer_name || '—'}</td><td>{row.customer_phone || '—'}</td><td>{row.reseller_id || '—'}</td><td>{money(row.deposit_amount_ugx)}</td><td><span className={`badge ${row.status}`}>{row.status}</span></td><td>{row.created_at || '—'}</td><td><button className="btn btn-sm" onClick={() => { setSelected(row); setDecisionReason(''); }}>Review</button></td></tr>)}
        {!filteredApplications.length && <tr><td colSpan="7" className="workflow-empty">{busy ? 'Loading applications…' : 'No customer applications found for this filter.'}</td></tr>}
      </tbody></table></div>
      {selected && <div className="modal-bg" onClick={() => setSelected(null)}><section className="modal workflow-detail" role="dialog" aria-modal="true" aria-label="Customer application review" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div><h2>{selected.customer_name || 'Customer application'}</h2><span className={`badge ${selected.status}`}>{selected.status}</span></div><button className="close" aria-label="Close" onClick={() => setSelected(null)}>×</button></div>
        <div className="modal-body">
          <div className="workflow-detail-grid">
            <div><h3>Customer details</h3><p><b>Phone:</b> {selected.customer_phone || '—'}</p><p><b>Email:</b> {selected.customer_email || '—'}</p><p><b>NIN:</b> {selected.nin || '—'}</p><p><b>Occupation:</b> {selected.occupation || '—'}</p><p><b>Monthly income:</b> {money(selected.monthly_income_ugx)}</p><p><b>Retailer:</b> {selected.reseller_id || '—'}</p></div>
            <div><h3>Financing and device</h3><p><b>Initial deposit:</b> {money(selected.deposit_amount_ugx)}</p><p><b>Submitted:</b> {selected.created_at || '—'}</p><pre>{pretty(selected.device_json) || 'No device details supplied.'}</pre><pre>{pretty(selected.finance_plan_json) || 'No financing plan details supplied.'}</pre></div>
          </div>
          <h3>Guarantor details</h3><pre>{pretty(selected.guarantor_json) || 'No guarantor details supplied.'}</pre>
          <h3>Customer and guarantor KYC images</h3><MediaGallery value={selected.kyc_media_json} title="KYC" />
          {selected.status === 'pending' ? <>
            <label className="field"><span>Decision reason (required for rejection)</span><textarea rows="3" value={decisionReason} onChange={e => setDecisionReason(e.target.value)} placeholder="Explain what is missing or why the application is rejected." /></label>
            <div className="modal-actions"><button className="btn" onClick={() => decide('reject')} disabled={saving}>Reject application</button><button className="btn btn-primary" onClick={() => decide('approve')} disabled={saving}>Approve application</button></div>
          </> : <p className="summary"><b>Decision:</b> {selected.status} {selected.decision_reason ? `— ${selected.decision_reason}` : ''}<br/><b>Reviewed by:</b> {selected.reviewed_by || '—'}</p>}
        </div>
      </section></div>}
    </>}

    {view === 'commissions' && <>
      <div className="workflow-columns">
        <form className="card workflow-form" onSubmit={saveSettings}>
          <h3>Commission settings</h3><p className="muted-workflow">Set or update the commission terms for a retailer.</p>
          <label className="field"><span>Retailer</span><select required value={settingForm.reseller_id} onChange={e => chooseReseller(e.target.value)}><option value="">Select retailer</option>{resellers.map(r => <option key={r.email} value={r.email}>{r.name || r.email} — {r.email}</option>)}</select></label>
          <label className="field"><span>Commission rate (%)</span><input type="number" min="0" max="100" step="0.01" required value={settingForm.rate_percent} onChange={e => setSettingForm(v => ({ ...v, rate_percent: e.target.value }))} /></label>
          <label className="field"><span>Fixed commission (UGX)</span><input type="number" min="0" step="1" required value={settingForm.fixed_amount_ugx} onChange={e => setSettingForm(v => ({ ...v, fixed_amount_ugx: e.target.value }))} /></label>
          <label className="field"><span>Commission applies to</span><select value={settingForm.applies_to} onChange={e => setSettingForm(v => ({ ...v, applies_to: e.target.value }))}><option value="received_payment">Received customer payment</option><option value="device_sale">Device sale</option></select></label>
          <label className="workflow-check"><input type="checkbox" checked={settingForm.active} onChange={e => setSettingForm(v => ({ ...v, active: e.target.checked }))} /> Active commission setting</label>
          <button className="btn btn-primary" type="submit" disabled={saving || !settingForm.reseller_id}>Save commission settings</button>
          <div className="workflow-settings-list"><h4>Current retailer settings</h4>{settings.map(s => <button type="button" key={s.reseller_id} onClick={() => chooseReseller(s.reseller_id)}><span>{s.reseller_id}</span><b>{Number(s.rate_percent)}% + {money(s.fixed_amount_ugx)}</b><small>{Number(s.active) ? 'Active' : 'Inactive'}</small></button>)}{!settings.length && <p className="muted-workflow">No commission settings saved yet.</p>}</div>
        </form>
        <form className="card workflow-form" onSubmit={recordCommission}>
          <h3>Record a commission</h3><p className="muted-workflow">Record a customer payment against the retailer's saved commission terms.</p>
          <label className="field"><span>Retailer</span><select required value={recordForm.reseller_id} onChange={e => setRecordForm(v => ({ ...v, reseller_id: e.target.value }))}><option value="">Select retailer</option>{resellers.map(r => <option key={r.email} value={r.email}>{r.name || r.email} — {r.email}</option>)}</select></label>
          <label className="field"><span>Payment reference</span><input required maxLength="160" value={recordForm.payment_reference} onChange={e => setRecordForm(v => ({ ...v, payment_reference: e.target.value }))} /></label>
          <label className="field"><span>Payment amount (UGX)</span><input required type="number" min="1" step="1" value={recordForm.payment_amount_ugx} onChange={e => setRecordForm(v => ({ ...v, payment_amount_ugx: e.target.value }))} /></label>
          <label className="field"><span>Customer application ID (optional)</span><input value={recordForm.customer_application_id} onChange={e => setRecordForm(v => ({ ...v, customer_application_id: e.target.value }))} /></label>
          <button className="btn btn-primary" type="submit" disabled={saving || !recordForm.reseller_id}>Calculate and record commission</button>
        </form>
      </div>
      <div className="workflow-heading workflow-subheading"><div><h3>Commission records</h3><p className="muted-workflow">Recorded payment reference, calculation and current status.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Retailer</th><th>Payment reference</th><th>Payment amount</th><th>Rate</th><th>Fixed</th><th>Commission</th><th>Status</th><th>Date</th></tr></thead><tbody>
        {commissions.map(row => <tr key={row.id}><td>{row.reseller_id}</td><td>{row.payment_reference}</td><td>{money(row.payment_amount_ugx)}</td><td>{Number(row.rate_percent)}%</td><td>{money(row.fixed_amount_ugx)}</td><td><b>{money(row.commission_amount_ugx)}</b></td><td><span className={`badge ${row.status}`}>{row.status}</span></td><td>{row.created_at || '—'}</td></tr>)}
        {!commissions.length && <tr><td colSpan="8" className="workflow-empty">{busy ? 'Loading commissions…' : 'No commission records found.'}</td></tr>}
      </tbody></table></div>
    </>}
  </section>;
}
