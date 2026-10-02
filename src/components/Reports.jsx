import React, { useEffect, useState } from 'react';
import { api } from '../config.js';

export function Reports({ toast }) {
  const [summary, setSummary] = useState(null);
  const [devices, setDevices] = useState([]);
  const [range, setRange] = useState('30d');

  useEffect(() => {
    Promise.all([api('/api/dashboard/summary'), api('/api/dashboard/devices')])
      .then(([s, d]) => { setSummary(s); setDevices(Array.isArray(d) ? d : []); })
      .catch(e => toast('Failed: ' + e.message, 'error'));
  }, [range]);

  function exportCSV() {
    const rows = [
      ['IMEI', 'Customer', 'Reseller', 'Status', 'Paid', 'Total', 'Balance', 'Next Due'],
      ...devices.map(d => [d.imei, d.customer_name || '', d.reseller_email || '', d.status,
        d.paid_count || 0, d.total_count || 0, d.balance_ugx || 0, d.next_due_date || '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `signal-devices-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported', 'success');
  }

  if (!summary) return <div className="loading">Loading reports…</div>;
  const rate = summary.total_devices > 0 ? Math.round((summary.active_devices / summary.total_devices) * 100) : 0;

  return (
    <div>
      <div className="header-actions" style={{marginBottom: 16, justifyContent: 'flex-start'}}>
        <button className="btn" onClick={exportCSV}>Export Devices CSV</button>
        <select value={range} onChange={e => setRange(e.target.value)} className="btn">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid">
        <div className="card"><div className="label">Total Devices</div><div className="value">{summary.total_devices}</div></div>
        <div className="card"><div className="label">Active</div><div className="value" style={{color: '#28a745'}}>{summary.active_devices}</div></div>
        <div className="card"><div className="label">Locked</div><div className="value" style={{color: '#dc3545'}}>{summary.locked_devices}</div></div>
        <div className="card"><div className="label">Overdue</div><div className="value" style={{color: '#ffc107'}}>{summary.overdue_schedules}</div></div>
        <div className="card"><div className="label">Collected</div><div className="value" style={{fontSize: 18}}>UGX {Number(summary.total_collected_ugx).toLocaleString()}</div></div>
        <div className="card"><div className="label">Recovery</div><div className="value">{rate}%</div></div>
      </div>
    </div>
  );
}
