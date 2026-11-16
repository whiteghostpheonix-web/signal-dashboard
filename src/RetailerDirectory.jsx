import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './config.js';

const money = value => `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
const initials = value => String(value || 'R').trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || '').join('') || 'R';

export default function RetailerDirectory({ onEdit, selectedEmail = '', toast = () => {} }) {
  const [retailers, setRetailers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [applications, setApplications] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('overview');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerImages, setCustomerImages] = useState({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [r, d, a, c, w] = await Promise.all([
        api('/api/resellers'), api('/api/dashboard/devices'),
        api('/api/admin/retailer/applications'), api('/api/admin/retailer/commissions'),
        api('/api/admin/retailer/withdrawals'),
      ]);
      setRetailers(Array.isArray(r) ? r : []); setDevices(Array.isArray(d) ? d : []);
      setApplications(a.applications || []); setCommissions(c.commissions || []); setWithdrawals(w.withdrawals || []);
    } catch (error) { toast(`Could not load retailer profiles: ${error.message}`, 'error'); }
    finally { setBusy(false); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selectedEmail && retailers.some(r => r.email === selectedEmail)) openProfile(selectedEmail); }, [selectedEmail, retailers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return retailers.filter(r => !q || [r.name, r.email, r.phone, r.region, r.nin].some(v => String(v || '').toLowerCase().includes(q)));
  }, [retailers, search]);

  const profile = selected ? retailers.find(r => r.email === selected) : null;
  const ownDevices = profile ? devices.filter(d => d.reseller_email === profile.email) : [];
  const ownApps = profile ? applications.filter(a => a.retailer_email === profile.email) : [];
  const ownCommissions = profile ? commissions.filter(c => c.retailer_email === profile.email) : [];
  const ownWithdrawals = profile ? withdrawals.filter(w => w.retailer_email === profile.email) : [];
  const paidInstallments = ownDevices.reduce((sum, d) => sum + Number(d.paid_count || 0), 0);
  const balance = ownDevices.reduce((sum, d) => sum + Number(d.balance_ugx || 0), 0);

  function openProfile(email) { setSelected(email); setTab('overview'); setSelectedCustomer(null); }
  async function openCustomerKyc(app) {
    setSelectedCustomer(app); setCustomerImages({});
    const paths = [];
    Object.entries(app.customer?.media || {}).forEach(([label, key]) => paths.push([label, key]));
    (app.guarantors || []).forEach((g, i) => Object.entries(g.media || {}).forEach(([label, key]) => paths.push([`Guarantor ${i + 1} ${label}`, key])));
    try {
      const entries = await Promise.all(paths.map(async ([label, key]) => [label, (await api(`/api/admin/retailer/media?application_id=${encodeURIComponent(app.id)}&key=${encodeURIComponent(key)}`)).data_url]));
      setCustomerImages(Object.fromEntries(entries));
    } catch (error) { toast(`Could not load customer KYC images: ${error.message}`, 'error'); }
  }
  function image(label, url) { return url ? <a className="retailer-kyc-image" href={url} target="_blank" rel="noreferrer"><img src={url} alt={label}/><span>{label}</span></a> : <div className="retailer-kyc-missing"><span>{label}</span><small>Not uploaded</small></div>; }

  return <section className="retailer-directory">
    <div className="workflow-heading retailer-directory-heading"><div><p className="workflow-eyebrow">Retailer network</p><h2>Retailer profiles</h2><p className="muted-workflow">Open a retailer profile to view identity documents, registered devices, customer applications, payment progress and commissions.</p></div><button className="btn" onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button></div>
    <div className="retailer-directory-tools"><input className="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search retailer name, ID/email, phone or region…"/><span>{filtered.length} retailer{filtered.length === 1 ? '' : 's'}</span></div>
    <div className="retailer-profile-grid">
      {filtered.map(r => {
        const ds = devices.filter(d => d.reseller_email === r.email);
        const apps = applications.filter(a => a.retailer_email === r.email);
        const earned = commissions.filter(c => c.retailer_email === r.email).reduce((s, c) => s + Number(c.commission_amount_ugx || 0), 0);
        return <button type="button" className="retailer-profile-card" key={r.email} onClick={() => openProfile(r.email)}>
          <div className="retailer-card-top"><span className="retailer-avatar">{r.photo_url ? <img src={r.photo_url} alt=""/> : initials(r.name || r.email)}</span><span className="retailer-card-arrow">›</span></div>
          <strong>{r.name || 'Retailer'}</strong><span className="retailer-card-email">{r.email}</span><span className="retailer-card-meta">{r.phone || 'No phone'} · {r.region || 'Region not set'}</span>
          <div className="retailer-card-stats"><span><b>{ds.length}</b>Devices</span><span><b>{apps.length}</b>Applications</span><span><b>{money(earned)}</b>Earned</span></div>
          <span className="retailer-card-cta">View retailer profile <b>→</b></span>
        </button>;
      })}
      {!filtered.length && <div className="retailer-empty">{busy ? 'Loading retailer profiles…' : 'No retailers match this search.'}</div>}
    </div>

    {profile && <div className="modal-bg" onClick={() => setSelected(null)}><section className="modal retailer-profile-modal" role="dialog" aria-modal="true" aria-label={`${profile.name || profile.email} retailer profile`} onClick={e => e.stopPropagation()}>
      <div className="modal-header retailer-profile-header"><div className="retailer-profile-identity"><span className="retailer-avatar retailer-avatar-large">{profile.photo_url ? <img src={profile.photo_url} alt=""/> : initials(profile.name || profile.email)}</span><div><h2>{profile.name || 'Retailer profile'}</h2><p>{profile.email}</p><small>{profile.phone || 'No phone'} · {profile.region || 'Region not set'}</small></div></div><div className="retailer-profile-header-actions"><button className="btn btn-sm" onClick={() => onEdit(profile.email)}>Edit profile</button><button className="close" aria-label="Close" onClick={() => setSelected(null)}>×</button></div></div>
      <div className="retailer-profile-tabs" role="tablist" aria-label="Retailer profile sections">{[['overview','Overview'],['kyc','Retailer KYC'],['devices','Devices & payments'],['customers','Customer KYC'],['commissions','Commissions'],['withdrawals','Withdrawals']].map(([key,label]) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>{label}{key === 'customers' && ownApps.length ? ` (${ownApps.length})` : ''}</button>)}</div>
      <div className="modal-body retailer-profile-body">
        {tab === 'overview' && <><div className="retailer-summary-grid"><div><span>Registered devices</span><b>{ownDevices.length}</b></div><div><span>Customer applications</span><b>{ownApps.length}</b></div><div><span>Paid instalments</span><b>{paidInstallments}</b></div><div><span>Outstanding balance</span><b>{money(balance)}</b></div></div><div className="retailer-info-card"><h3>Retailer details</h3><p><b>Retailer ID / login:</b> {profile.email}</p><p><b>National ID (NIN):</b> {profile.nin || '—'}</p><p><b>Occupation:</b> {profile.occupation || '—'}</p><p><b>Physical address:</b> {profile.address || '—'}</p><p><b>Registered:</b> {profile.created_at || '—'}</p></div><div className="retailer-info-card"><h3>Recent devices</h3>{ownDevices.slice(0,5).map(d => <div className="retailer-mini-row" key={d.imei}><span><b>{d.customer_name || 'Customer device'}</b><small>{d.imei}</small></span><span className={`badge ${d.status}`}>{d.status}</span></div>)}{!ownDevices.length && <p className="muted-workflow">No devices assigned to this retailer yet.</p>}</div></>}
        {tab === 'kyc' && <><div className="retailer-info-card"><h3>Retailer identity information</h3><p><b>Full name:</b> {profile.name || '—'}</p><p><b>Email:</b> {profile.email}</p><p><b>Phone:</b> {profile.phone || '—'}</p><p><b>NIN:</b> {profile.nin || '—'}</p><p><b>Occupation:</b> {profile.occupation || '—'}</p><p><b>Address:</b> {profile.address || '—'}</p></div><div className="retailer-kyc-gallery">{image('Retailer photo', profile.photo_url)}{image('National ID — front', profile.id_front_url)}{image('National ID — back', profile.id_back_url)}</div></>}
        {tab === 'devices' && <><div className="retailer-summary-grid"><div><span>Devices</span><b>{ownDevices.length}</b></div><div><span>Paid instalments</span><b>{paidInstallments}</b></div><div><span>Balance</span><b>{money(balance)}</b></div></div><div className="table-wrap"><table><thead><tr><th>IMEI</th><th>Customer</th><th>Status</th><th>Paid instalments</th><th>Balance</th><th>Next due</th></tr></thead><tbody>{ownDevices.map(d => <tr key={d.imei}><td>{d.imei}</td><td>{d.customer_name || '—'}<br/><small>{d.customer_phone || ''}</small></td><td><span className={`badge ${d.status}`}>{d.status}</span></td><td>{`${Number(d.paid_count || 0)} / ${Number(d.total_count || 0)}`}</td><td>{money(d.balance_ugx)}</td><td>{d.next_due_date || '—'}</td></tr>)}{!ownDevices.length && <tr><td colSpan="6" className="workflow-empty">No devices for this retailer.</td></tr>}</tbody></table></div></>}
        {tab === 'customers' && <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone / NIN</th><th>Device</th><th>Plan</th><th>Deposit</th><th>Status</th><th></th></tr></thead><tbody>{ownApps.map(a => <tr key={a.id}><td>{a.customer?.full_name || '—'}</td><td>{a.customer?.phone || '—'}<br/><small>{a.customer?.nin || ''}</small></td><td>{a.device?.device_model || '—'}</td><td>{a.plan_name || `Plan #${a.plan_id}`}</td><td>{money(a.deposit_amount_ugx)}</td><td><span className={`badge ${a.status}`}>{a.status}</span></td><td><button className="btn btn-sm" onClick={() => openCustomerKyc(a)}>View KYC</button></td></tr>)}{!ownApps.length && <tr><td colSpan="7" className="workflow-empty">No customer applications recorded.</td></tr>}</tbody></table><p className="muted-workflow retailer-note">Full customer KYC review and image captures remain available under Customer applications.</p></div>}
        {selectedCustomer && <div className="retailer-customer-kyc"><div className="retailer-customer-kyc-head"><h3>{selectedCustomer.customer?.full_name || 'Customer KYC'}</h3><button className="btn btn-sm" onClick={() => setSelectedCustomer(null)}>Close KYC</button></div><p><b>Phone:</b> {selectedCustomer.customer?.phone || '—'} · <b>NIN:</b> {selectedCustomer.customer?.nin || '—'}</p><p><b>Address:</b> {selectedCustomer.customer?.address || '—'} · <b>Occupation:</b> {selectedCustomer.customer?.occupation || '—'}</p><div className="retailer-kyc-gallery">{Object.entries(customerImages).map(([label, src]) => <a className="retailer-kyc-image" key={label} href={src} target="_blank" rel="noreferrer"><img src={src} alt={label}/><span>{label.replaceAll('_',' ')}</span></a>)}{!Object.keys(customerImages).length && <p className="muted-workflow">No KYC images attached, or images are still loading.</p>}</div></div>}
        {tab === 'commissions' && <div className="table-wrap"><table><thead><tr><th>Device</th><th>IMEI</th><th>Plan</th><th>Rate</th><th>Earned</th><th>Status</th></tr></thead><tbody>{ownCommissions.map(c => <tr key={c.id}><td>{c.device_model}</td><td>{c.device_imei}</td><td>{c.plan_name}</td><td>{c.rate_percent}%</td><td><b>{money(c.commission_amount_ugx)}</b></td><td>{c.status}</td></tr>)}{!ownCommissions.length && <tr><td colSpan="6" className="workflow-empty">No earned commissions recorded.</td></tr>}</tbody></table></div>}
        {tab === 'withdrawals' && <div className="table-wrap"><table><thead><tr><th>Request</th><th>Amount</th><th>Status</th><th>Payout reference</th><th>Date</th></tr></thead><tbody>{ownWithdrawals.map(w => <tr key={w.id}><td>{w.id}</td><td>{money(w.amount_ugx)}</td><td><span className={`badge ${w.status}`}>{w.status}</span></td><td>{w.payout_reference || '—'}</td><td>{w.created_at || '—'}</td></tr>)}{!ownWithdrawals.length && <tr><td colSpan="5" className="workflow-empty">No withdrawal requests.</td></tr>}</tbody></table></div>}
      </div>
    </section></div>}
  </section>;
}
