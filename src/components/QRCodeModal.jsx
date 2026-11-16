import React, { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import QRCode from 'qrcode';
import { api } from '../config.js';

const APK_URL = 'https://device-finance-api.whiteghostpheonix.workers.dev/download/apk/signal-dpc-v0.2.4.apk';
const APK_CHECKSUM = '59eAWEHMKwh8GIG2kYvDpNV/0Qh+WP4APL1w6OG8NrU=';
const COMPONENT = 'ug.co.signalelectronics.devicefinance/.SignalDeviceAdminReceiver';
const SERVER_URL = 'https://device-finance-api.whiteghostpheonix.workers.dev';

function buildPayload(imei, enrollmentToken) {
  return {
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': COMPONENT,
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': APK_URL,
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM': APK_CHECKSUM,
    'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
    'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': true,
    'android.app.extra.PROVISIONING_SKIP_USER_SETUP': true,
    'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': { server_url: SERVER_URL, imei, enrollment_token: enrollmentToken },
  };
}

export function QRCodeModal({ imei, onClose }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const tokenData = await api(`/api/devices/${encodeURIComponent(imei)}/enrollment-token`, { method: 'POST' });
        const url = await QRCode.toDataURL(JSON.stringify(buildPayload(imei, tokenData.enrollment_token)), { width: 400, margin: 2 });
        setQr(url);
      } catch (e) {
        setError(e?.message || String(e));
      }
    })();
  }, [imei]);

  return (
    <Modal title={`Provisioning QR — ${imei}`} onClose={onClose} width={520}>
      {error && <div className="error">QR error: {error}</div>}
      {!qr && !error && <div className="loading">Generating QR…</div>}
      {qr && (
        <div style={{ textAlign: 'center' }}>
          <img src={qr} alt="QR" style={{ width: '100%', maxWidth: 400, borderRadius: 8 }} />
          <p style={{ color: '#666', fontSize: 13, marginTop: 16 }}>
            On the phone: factory reset → tap same spot 6 times at welcome screen → scan this QR.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <a className="btn btn-primary" download={`provision-${imei}.png`} href={qr}>Download PNG</a>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
