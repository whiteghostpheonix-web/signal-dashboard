import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.jsx';
import { api } from '../config.js';
import QRCode from 'qrcode';

const APK_URL = 'https://device-finance-api.whiteghostpheonix.workers.dev/download/apk/signal-dpc-v0.2.5.apk';
const APK_CHECKSUM = 'pDhJVU3m0seE9HJjzySe7FCG8WL3wQe7k8g2Y00Vyqk=';
const COMPONENT = 'ug.co.signalelectronics.devicefinance/.SignalDeviceAdminReceiver';
const SERVER_URL = 'https://device-finance-api.whiteghostpheonix.workers.dev';

function buildPayload(imei, planId, startDate, enrollmentToken) {
  const extras = { server_url: SERVER_URL, enrollment_token: enrollmentToken };
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
  const [resellers, setResellers] = useState([]);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const selectedPlan = plans.find(p => String(p.id) === String(planId)) || null;
  const [paymentCode, setPaymentCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/api/plans').then(data => setPlans(Array.isArray(data) ? data : [])).catch(() => setPlans([]));
    api('/api/resellers').then(data => setResellers(Array.isArray(data) ? data : [])).catch(() => setResellers([]));
  }, []);

  async function register() {
    if (!/^[A-Za-z0-9._:-]{6,32}$/.test(imei.trim())) return toast('Enter a valid IMEI or Android ID (6–32 letters or numbers)', 'error');
    if (planId && !startDate) return toast('Choose the first installment date', 'error');
    setBusy(true);
    setErr(null);
    try {
      // Create the device credential locally so the QR can be validated before registration.
      const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
      const enrollmentToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
      const payloadJson = JSON.stringify(buildPayload(imei.trim(), planId || null, startDate, enrollmentToken));
      const url = await QRCode.toDataURL(payloadJson, { width: 400, margin: 2, errorCorrectionLevel: 'M' });
      const result = await api('/api/devices', {
        method: 'POST',
        body: JSON.stringify({
          imei: imei.trim(), customer_name: name, customer_phone: phone,
          reseller_email: resellerEmail || undefined,
          pending_plan_id: planId || undefined,
          start_date: startDate,
          enrollment_token: enrollmentToken,
        }),
      });

      setPaymentCode(result.payment_code || '');
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
              <input value={imei} onChange={e => setImei(e.target.value.trim())} placeholder="15-digit IMEI or Android ID" autoComplete="off" required />
              <small className="field-hint">Enter the phone’s IMEI or Android ID. Duplicate identifiers are blocked.</small></label>
            <label className="field"><span>Customer Phone</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+256 7XX XXX XXX" /></label>
          </div>

          <label className="field"><span>Customer Name</span>
            <input value={name} onChange={e => setName(e.target.value)} /></label>

          <label className="field"><span>Assign Retailer (optional)</span>
            <select value={resellerEmail} onChange={e => setResellerEmail(e.target.value)}>
              <option value="">— No retailer assigned —</option>
              {resellers.map(r => <option key={r.email} value={r.email}>{r.name || r.email} · {r.email}</option>)}
            </select></label>

          <div className="form-grid">
            <label className="field"><span>Payment Plan</span>
              <select value={planId} onChange={e => setPlanId(e.target.value)}>
                <option value="">— No plan (assign later) —</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.plan_name} — UGX {Number(p.total_amount_ugx).toLocaleString()} · {p.installment_count} × {p.frequency || 'monthly'}{p.has_deposit ? ' + deposit' : ''}
                  </option>
                ))}
              </select></label>
            <label className="field"><span>First Installment Date</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          </div>

          {selectedPlan && (
            <div className="device-plan-preview">
              <div><strong>{selectedPlan.plan_name}</strong><span>Plan selected</span></div>
              <div className="device-plan-metrics"><span><b>{Number(selectedPlan.installment_count || 0).toLocaleString()}</b> payments</span><span><b>UGX {Number(selectedPlan.total_amount_ugx || 0).toLocaleString()}</b> total</span>{Number(selectedPlan.has_deposit) === 1 && <span><b>UGX {Number(selectedPlan.deposit_amount || 0).toLocaleString()}</b> deposit</span>}</div>
              <small>Payment schedule will be created when this device is registered.</small>
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
            {paymentCode && <div className="device-payment-code">Customer payment code: <b>{paymentCode}</b></div>}
            {planId ? ' Payment schedule created and linked to the selected plan.' : ' No plan assigned — assign one from the device details later.'}
          </div>
          <img src={qrDataUrl} alt="Provisioning QR" style={{width: '100%', maxWidth: 400, borderRadius: 8}} />
          <p className="device-qr-instructions">
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
