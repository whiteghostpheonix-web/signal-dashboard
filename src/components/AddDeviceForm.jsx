import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.jsx';
import { api } from '../config.js';
import QRCode from 'qrcode';

const APK_URL = 'https://device-finance-api.whiteghostpheonix.workers.dev/download/apk/signal-dpc-v0.2.1-alpha.apk';
const APK_CHECKSUM = '3z6gmORVcNig21inY3AP3iV8SSinu0GuIZpNLYEWM2I';
const COMPONENT = 'ug.co.signalelectronics.devicefinance/.SignalDeviceAdminReceiver';
const SERVER_URL = 'https://device-finance-api.whiteghostpheonix.workers.dev';

function buildPayload(imei, planId, startDate) {
  const extras = { server_url: SERVER_URL };
  if (imei) extras.imei = imei;
  if (planId) extras.pending_plan_id = String(planId);
  if (startDate) extras.start_date = startDate;
  return {
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': COMPONENT,
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': APK_URL,
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM': APK_CHECKSUM,
    'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
    'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': true,
    'android.app.extra.PROVISIONING_SKIP_USER_SETUP': true,
    'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': extras,
  };
}

export function AddDeviceForm({ onClose, onSuccess, toast }) {
  const [imei, setImei] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [resellerEmail, setResellerEmail] = useState('');
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/api/plans').then(setPlans).catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (!planId) { setSelectedPlan(null); return; }
    api(`/api/plans/${planId}`).then(setSelectedPlan).catch(() => setSelectedPlan(null));
  }, [planId]);

  async function register() {
    if (!imei) return toast('IMEI required', 'error');
    setBusy(true);
    setErr(null);
    try {
      await api('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          imei, customer_name: name, customer_phone: phone,
          reseller_email: resellerEmail || undefined,
        }),
      });

      // QR generation — bundled qrcode, no CDN needed
      const payloadJson = JSON.stringify(buildPayload(imei, planId || null, startDate));
      const url = await QRCode.toDataURL(payloadJson, { width: 400, margin: 2 });

      setQrDataUrl(url);
      setRegistered(true);
      toast('Device registered — QR ready', 'success');
      onSuccess();
    } catch (e) {
      const msg = (typeof e === 'string') ? e
        : (e?.message) ? e.message
        : JSON.stringify(e);
      setErr(msg);
      toast('Failed: ' + msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={registered ? 'Scan This QR on the Phone' : 'Register & Enroll Device'} onClose={onClose} width={650}>
      {!registered && (
        <form onSubmit={e => { e.preventDefault(); register(); }}>
          {err && <div className="error">Error: {err}</div>}

          <div className="form-grid">
            <label className="field"><span>Device IMEI / Android ID *</span>
              <input value={imei} onChange={e => setImei(e.target.value)} placeholder="e.g. 841bd7e1c2e5e1c0" required /></label>
            <label className="field"><span>Customer Phone</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+256 7XX XXX XXX" /></label>
          </div>

          <label className="field"><span>Customer Name</span>
            <input value={name} onChange={e => setName(e.target.value)} /></label>

          <label className="field"><span>Reseller Email (optional)</span>
            <input type="email" value={resellerEmail} onChange={e => setResellerEmail(e.target.value)} placeholder="reseller@example.com" /></label>

          <div className="form-grid">
            <label className="field"><span>Payment Plan</span>
              <select value={planId} onChange={e => setPlanId(e.target.value)}>
                <option value="">— No plan (assign later) —</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plan_name} — UGX {Number(p.total_amount_ugx).toLocaleString()} · {p.installment_count} × {p.frequency || 'monthly'}
                  </option>
                ))}
              </select></label>
            <label className="field"><span>First Installment Date</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          </div>

          {selectedPlan && (
            <div className="summary">
              <strong>Plan preview:</strong> {selectedPlan.installments?.length || 0} payments, total UGX {Number(selectedPlan.total_amount_ugx).toLocaleString()}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Registering…' : 'Register & Generate QR'}
            </button>
          </div>
        </form>
      )}

      {registered && qrDataUrl && (
        <div style={{textAlign: 'center'}}>
          <div style={{background: '#e7f5ff', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13}}>
            <strong>Device {imei} registered.</strong>
            {planId ? ' Plan will be auto-assigned on first heartbeat.' : ' Assign a plan later.'}
          </div>
          <img src={qrDataUrl} alt="Provisioning QR" style={{width: '100%', maxWidth: 400, borderRadius: 8}} />
          <p style={{color: '#666', fontSize: 13, marginTop: 16}}>
            <strong>On the phone:</strong><br/>
            1. Factory reset<br/>
            2. At the welcome screen, tap the same spot <strong>6 times</strong><br/>
            3. Scan this QR
          </p>
          <div style={{display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16}}>
            <a className="btn btn-primary" download={`provision-${imei}.png`} href={qrDataUrl}>Download PNG</a>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
