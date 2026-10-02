import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.jsx';
import { ImageUploader } from './ImageUploader.jsx';
import { api } from '../config.js';

export function ResellerForm({ email, onClose, onSuccess, toast }) {
  const [form, setForm] = useState({
    email: '', name: '', phone: '', region: '', address: '', nin: '', occupation: '',
    photo: null, id_front: null, id_back: null,
  });
  const [existing, setExisting] = useState({});
  const [busy, setBusy] = useState(false);
  const [ninStatus, setNinStatus] = useState(null);

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const r = await api(`/api/resellers/${encodeURIComponent(email)}`);
        if (r) {
          setForm({ email: r.email, name: r.name || '', phone: r.phone || '',
            region: r.region || '', address: r.address || '', nin: r.nin || '', occupation: r.occupation || '',
            photo: null, id_front: null, id_back: null });
          setExisting({ photo_url: r.photo_url, id_front_url: r.id_front_url, id_back_url: r.id_back_url });
        }
      } catch (_) {}
    })();
  }, [email]);

  async function checkNin(nin) {
    if (!nin || nin.length < 14) { setNinStatus(null); return; }
    try {
      const r = await api('/api/validate-nin', { method: 'POST', body: JSON.stringify({ nin }) });
      setNinStatus(r.valid ? 'valid' : `invalid: ${r.reason}`);
    } catch (e) { setNinStatus('error'); }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/resellers', { method: 'POST', body: JSON.stringify({
        email: form.email, name: form.name, phone: form.phone,
        region: form.region, address: form.address, nin: form.nin, occupation: form.occupation,
        photo_base64: form.photo?.startsWith?.('data:') ? form.photo : null,
        id_front_base64: form.id_front?.startsWith?.('data:') ? form.id_front : null,
        id_back_base64: form.id_back?.startsWith?.('data:') ? form.id_back : null,
      })});
      toast('Reseller KYC saved', 'success');
      onSuccess(); onClose();
    } catch (e) { toast('Rejected: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  const upd = (f, v) => setForm(x => ({ ...x, [f]: v }));

  return (
    <Modal title={email ? 'Edit Reseller KYC' : 'Add Reseller KYC'} onClose={onClose} width={720}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div>
            <label className="field"><span>Email (Cloudflare Access login) *</span>
              <input type="email" value={form.email} required disabled={!!email} onChange={e => upd('email', e.target.value)} /></label>
            <label className="field"><span>Full Name</span>
              <input value={form.name} onChange={e => upd('name', e.target.value)} /></label>
            <label className="field"><span>Phone</span>
              <input value={form.phone} onChange={e => upd('phone', e.target.value)} /></label>
            <label className="field"><span>National ID (NIN)</span>
              <input value={form.nin} onChange={e => upd('nin', e.target.value.toUpperCase())}
                onBlur={e => checkNin(e.target.value)} placeholder="CM8901234567890" />
              {ninStatus === 'valid' && <small style={{color: 'green'}}>✅ Valid</small>}
              {ninStatus && ninStatus !== 'valid' && <small style={{color: 'red'}}>{ninStatus}</small>}
            </label>
            <label className="field"><span>Occupation</span>
              <input value={form.occupation} onChange={e => upd('occupation', e.target.value)} /></label>
            <label className="field"><span>Region</span>
              <input value={form.region} onChange={e => upd('region', e.target.value)} /></label>
            <label className="field"><span>Physical Address</span>
              <textarea rows={2} value={form.address} onChange={e => upd('address', e.target.value)} /></label>
          </div>
          <div>
            <label className="field"><span>Reseller Photo</span>
              <ImageUploader value={form.photo || existing.photo_url} onChange={v => upd('photo', v)} label="Reseller" /></label>
            <label className="field"><span>National ID — Front</span>
              <ImageUploader value={form.id_front || existing.id_front_url} onChange={v => upd('id_front', v)} label="ID Front" /></label>
            <label className="field"><span>National ID — Back</span>
              <ImageUploader value={form.id_back || existing.id_back_url} onChange={v => upd('id_back', v)} label="ID Back" /></label>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Reseller KYC'}</button>
        </div>
      </form>
    </Modal>
  );
}
