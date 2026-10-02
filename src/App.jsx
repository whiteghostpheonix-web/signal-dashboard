import React, { useEffect, useState } from 'react';
import DeviceDetail from './DeviceDetail.jsx';
import { AddDeviceForm } from './components/AddDeviceForm.jsx';
import { CreatePlanForm } from './components/CreatePlanForm.jsx';
import { AssignPlanForm } from './components/AssignPlanForm.jsx';
import { CustomerForm } from './components/CustomerForm.jsx';
import { ResellerForm } from './components/ResellerForm.jsx';
import { QRCodeModal } from './components/QRCodeModal.jsx';
import { Reports } from './components/Reports.jsx';
import { ToastContainer } from './components/Toast.jsx';
import { api } from './config.js';

export default function App() {
  const [view, setView] = useState('devices');
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [editPlanId, setEditPlanId] = useState(null);
  const [showResellerForm, setShowResellerForm] = useState(false);
  const [editResellerEmail, setEditResellerEmail] = useState(null);
  const [assignPlanDevice, setAssignPlanDevice] = useState(null);
  const [kycDevice, setKycDevice] = useState(null);
  const [qrDevice, setQrDevice] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  function toast(message, type = 'info') {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
  }
  function removeToast(id) { setToasts(t => t.filter(x => x.id !== id)); }

  async function load() {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([api('/api/dashboard/summary'), api('/api/dashboard/devices')]);
      setSummary(s); setDevices(Array.isArray(d) ? d : []);
    } catch (e) { toast('Failed to load: ' + e.message, 'error'); }
    finally { setLoading(false); }
  }
  async function loadPlans() { try { setPlans(await api('/api/plans') || []); } catch (_) {} }
  async function loadResellers() { try { setResellers(await api('/api/resellers') || []); } catch (_) {} }

  useEffect(() => { load(); loadPlans(); loadResellers(); }, []);

  async function lockDevice(imei) {
    if (!confirm(`Lock device ${imei}?`)) return;
    try { await api('/api/commands/lock', { method: 'POST', body: JSON.stringify({ imei, reason: 'admin_dashboard' }) });
      toast('Lock command sent', 'success'); load(); }
    catch (e) { toast('Lock failed: ' + e.message, 'error'); }
  }
  async function unlockDevice(imei) {
    if (!confirm(`Unlock device ${imei}?`)) return;
    try { await api('/api/commands/unlock', { method: 'POST', body: JSON.stringify({ imei, reason: 'admin_dashboard' }) });
      toast('Unlock command sent', 'success'); load(); }
    catch (e) { toast('Unlock failed: ' + e.message, 'error'); }
  }

  const filtered = devices.filter(d => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (d.imei || '').toLowerCase().includes(q) ||
      (d.customer_name || '').toLowerCase().includes(q) ||
      (d.customer_phone || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="app"><div className="loading">Loading…</div></div>;

  return (
    <div className="app">
      <div className="header">
        <h1>Signal Electronics — Admin</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddDevice(true)}>+ Register Device</button>
          <button className="btn" onClick={() => { setEditPlanId(null); setShowCreatePlan(true); }}>+ New Plan</button>
          <button className="btn" onClick={() => { setEditResellerEmail(null); setShowResellerForm(true); }}>+ Add Reseller</button>
        </div>
      </div>

      <nav className="tabs">
        {['devices', 'plans', 'resellers', 'reports'].map(t => (
          <button key={t} className={view === t ? 'tab active' : 'tab'} onClick={() => setView(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {view === 'devices' && (
        <>
          {summary && (
            <div className="grid">
              <div className="card"><div className="label">Total Devices</div><div className="value">{summary.total_devices}</div></div>
              <div className="card"><div className="label">Active</div><div className="value" style={{color: '#28a745'}}>{summary.active_devices}</div></div>
              <div className="card"><div className="label">Locked</div><div className="value" style={{color: '#dc3545'}}>{summary.locked_devices}</div></div>
              <div className="card"><div className="label">Overdue</div><div className="value" style={{color: '#ffc107'}}>{summary.overdue_schedules}</div></div>
              <div className="card"><div className="label">Collected</div><div className="value" style={{fontSize: 18}}>UGX {Number(summary.total_collected_ugx).toLocaleString()}</div></div>
              <div className="card"><div className="label">Pending Cmds</div><div className="value">{summary.pending_commands}</div></div>
            </div>
          )}

          <div className="filters">
            <input className="search" placeholder="Search IMEI, customer, phone…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="btn" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
            <button className="btn" onClick={load}>Refresh</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th><th>Customer</th><th>Reseller</th><th>Status</th>
                  <th>Progress</th><th>Balance</th><th>Next Due</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.imei} onClick={() => setSelected(d.imei)}>
                    <td style={{fontFamily: 'monospace', fontSize: 12}}>{d.imei}</td>
                    <td>{d.customer_name || '—'}<br/><span style={{color: '#999', fontSize: 11}}>{d.customer_phone}</span></td>
                    <td style={{fontSize: 11, color: '#666'}}>{d.reseller_email || '—'}</td>
                    <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                    <td>{d.paid_count} / {d.total_count}</td>
                    <td>{Number(d.balance_ugx || 0).toLocaleString()}</td>
                    <td>{d.next_due_date || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="actions">
                        {d.status === 'locked'
                          ? <button className="btn btn-unlock btn-sm" onClick={() => unlockDevice(d.imei)}>Unlock</button>
                          : <button className="btn btn-lock btn-sm" onClick={() => lockDevice(d.imei)}>Lock</button>}
                        <button className="btn btn-sm" onClick={() => setQrDevice(d.imei)}>QR</button>
                        <button className="btn btn-sm" onClick={() => setKycDevice(d.imei)}>KYC</button>
                        <button className="btn btn-sm" onClick={() => setAssignPlanDevice(d.imei)}>Assign</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" style={{padding: 40, textAlign: 'center', color: '#999'}}>No devices match</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'plans' && (
        <>
          <div className="header-actions" style={{justifyContent: 'flex-start', marginBottom: 16}}>
            <button className="btn btn-primary" onClick={() => { setEditPlanId(null); setShowCreatePlan(true); }}>+ New Plan</button>
            <button className="btn" onClick={loadPlans}>Refresh</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Frequency</th><th>Installments</th><th>Total (UGX)</th><th>Grace</th><th></th></tr></thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id}>
                    <td>{p.plan_name}</td>
                    <td><span className="badge">{p.frequency || 'monthly'}</span></td>
                    <td>{p.installment_count}</td>
                    <td>{Number(p.total_amount_ugx).toLocaleString()}</td>
                    <td>{p.grace_period_days} days</td>
                    <td><button className="btn btn-sm" onClick={() => { setEditPlanId(p.id); setShowCreatePlan(true); }}>Edit</button></td>
                  </tr>
                ))}
                {plans.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', color: '#999', padding: 40}}>No plans yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'resellers' && (
        <>
          <div className="header-actions" style={{justifyContent: 'flex-start', marginBottom: 16}}>
            <button className="btn btn-primary" onClick={() => { setEditResellerEmail(null); setShowResellerForm(true); }}>+ Add Reseller</button>
            <button className="btn" onClick={loadResellers}>Refresh</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Region</th><th>Devices</th><th></th></tr></thead>
              <tbody>
                {resellers.map(r => {
                  const count = devices.filter(d => d.reseller_email === r.email).length;
                  return (
                    <tr key={r.email}>
                      <td style={{fontFamily: 'monospace', fontSize: 12}}>{r.email}</td>
                      <td>{r.name || '—'}</td><td>{r.phone || '—'}</td><td>{r.region || '—'}</td>
                      <td>{count}</td>
                      <td><button className="btn btn-sm" onClick={() => { setEditResellerEmail(r.email); setShowResellerForm(true); }}>Edit</button></td>
                    </tr>
                  );
                })}
                {resellers.length === 0 && <tr><td colSpan="6" style={{textAlign: 'center', color: '#999', padding: 40}}>No resellers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'reports' && <Reports toast={toast} />}

      {selected && <DeviceDetail imei={selected} onClose={() => { setSelected(null); load(); }} toast={toast} />}
      {showAddDevice && <AddDeviceForm onClose={() => setShowAddDevice(false)} onSuccess={load} toast={toast} />}
      {showCreatePlan && (
        <CreatePlanForm planId={editPlanId}
          onClose={() => { setShowCreatePlan(false); setEditPlanId(null); }}
          onSuccess={() => { load(); loadPlans(); }} toast={toast} />
      )}
      {showResellerForm && (
        <ResellerForm email={editResellerEmail}
          onClose={() => { setShowResellerForm(false); setEditResellerEmail(null); }}
          onSuccess={() => { loadResellers(); load(); }} toast={toast} />
      )}
      {assignPlanDevice && <AssignPlanForm imei={assignPlanDevice} onClose={() => setAssignPlanDevice(null)} onSuccess={load} toast={toast} />}
      {kycDevice && <CustomerForm imei={kycDevice} onClose={() => setKycDevice(null)} onSuccess={load} toast={toast} />}
      {qrDevice && <QRCodeModal imei={qrDevice} onClose={() => setQrDevice(null)} />}

      <ToastContainer toasts={toasts} remove={removeToast} />
    </div>
  );
}
