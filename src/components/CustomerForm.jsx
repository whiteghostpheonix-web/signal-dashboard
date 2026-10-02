import React, { useState, useEffect } from 'react';
import { Modal } from './Modal.jsx';
import { ImageUploader } from './ImageUploader.jsx';
import { api } from '../config.js';

const emptyCustomer = {
  full_name: '', phone: '', nin: '', dob: '', address: '',
  occupation: '', monthly_income: '',
  photo_base64: null, photo_with_reseller_base64: null,
  device_photo_base64: null, id_front_base64: null, id_back_base64: null,
};
const emptyGuarantor = (slot) => ({
  slot, full_name: '', phone: '', nin: '', relationship: '', address: '', occupation: '',
  photo: null, id_front: null, existingPhoto: null, existingId: null,
});

export function CustomerForm({ imei, onClose, onSuccess, toast }) {
  const [customer, setCustomer] = useState(emptyCustomer);
  const [existing, setExisting] = useState({});
  const [guarantors, setGuarantors] = useState([emptyGuarantor(1), emptyGuarantor(2)]);
  const [busy, setBusy] = useState(false);
  const [ninStatus, setNinStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/api/customers/${imei}`);
        if (r.customer) {
          setCustomer({ ...emptyCustomer,
            full_name: r.customer.full_name || '', phone: r.customer.phone || '',
            nin: r.customer.nin || '', dob: r.customer.dob || '',
            address: r.customer.address || '', occupation: r.customer.occupation || '',
            monthly_income: r.customer.monthly_income || '' });
          setExisting({
            photo_url: r.customer.photo_url, photo_with_reseller_url: r.customer.photo_with_reseller_url,
            device_photo_url: r.customer.device_photo_url, id_front_url: r.customer.id_front_url,
            id_back_url: r.customer.id_back_url,
          });
        }
        setGuarantors([1, 2].map(slot => {
          const e = r.guarantors?.find(x => x.slot === slot);
          return { ...emptyGuarantor(slot),
            full_name: e?.full_name || '', phone: e?.phone || '', nin: e?.nin || '',
            relationship: e?.relationship || '', address: e?.address || '', occupation: e?.occupation || '',
            existingPhoto: e?.photo_url || null, existingId: e?.id_front_url || null };
        }));
      } catch (_) {}
    })();
  }, [imei]);

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
      await api('/api/customers', { method: 'POST', body: JSON.stringify({
        imei, full_name: customer.full_name, phone: customer.phone, nin: customer.nin,
        dob: customer.dob, address: customer.address, occupation: customer.occupation,
        monthly_income: customer.monthly_income || null,
        photo_base64: customer.photo_base64, photo_with_reseller_base64: customer.photo_with_reseller_base64,
        device_photo_base64: customer.device_photo_base64,
        id_front_base64: customer.id_front_base64, id_back_base64: customer.id_back_base64,
      })});
      for (const g of guarantors) {
        if (!g.full_name && !g.phone) continue;
        await api(`/api/customers/${imei}/guarantors`, { method: 'POST', body: JSON.stringify({
          slot: g.slot, full_name: g.full_name, phone: g.phone, nin: g.nin,
          relationship: g.relationship, address: g.address, occupation: g.occupation,
          photo_base64: g.photo?.startsWith?.('data:') ? g.photo : null,
          id_front_base64: g.id_front?.startsWith?.('data:') ? g.id_front : null,
        })});
      }
      toast('KYC saved', 'success');
      onSuccess(); onClose();
    } catch (e) { toast('KYC rejected: ' + e.message, 'error'); }
    finally { setBusy(false); }
  }

  const updC = (f, v) => setCustomer(c => ({ ...c, [f]: v }));
  const updG = (i, f, v) => setGuarantors(g => g.map((x, j) => j === i ? { ...x, [f]: v } : x));

  return (
    <Modal title={`Customer KYC — ${imei}`} onClose={onClose} width={850}>
      <form onSubmit={submit}>
        <h3 style={{marginTop: 0}}>Customer Information</h3>
        <div className="form-grid">
          <div>
            <label className="field"><span>Full Name *</span>
              <input value={customer.full_name} required onChange={e => updC('full_name', e.target.value)} /></label>
            <label className="field"><span>Phone</span>
              <input value={customer.phone} onChange={e => updC('phone', e.target.value)} /></label>
            <label className="field"><span>National ID (NIN) *</span>
              <input value={customer.nin} onChange={e => updC('nin', e.target.value.toUpperCase())}
                onBlur={e => checkNin(e.target.value)} placeholder="CM8901234567890" />
              {ninStatus === 'valid' && <small style={{color: 'green'}}>✅ Valid Uganda NIN</small>}
              {ninStatus && ninStatus !== 'valid' && <small style={{color: 'red'}}>{ninStatus}</small>}
              {!ninStatus && <small style={{color: '#999', fontSize: 11}}>Format: CM/CF + 12 characters</small>}
            </label>
            <label className="field"><span>Date of Birth</span>
              <input type="date" value={customer.dob} onChange={e => updC('dob', e.target.value)} /></label>
            <label className="field"><span>Occupation</span>
              <input value={customer.occupation} onChange={e => updC('occupation', e.target.value)}
                placeholder="e.g. Teacher, Trader, Farmer" /></label>
            <label className="field"><span>Monthly Income (UGX)</span>
              <input type="number" value={customer.monthly_income} onChange={e => updC('monthly_income', e.target.value)} /></label>
            <label className="field"><span>Address</span>
              <textarea rows={2} value={customer.address} onChange={e => updC('address', e.target.value)} /></label>
          </div>
          <div>
            <label className="field"><span>Customer Photo</span>
              <ImageUploader value={customer.photo_base64 || existing.photo_url} onChange={v => updC('photo_base64', v)} label="Customer" /></label>
            <label className="field"><span>Photo With Reseller</span>
              <ImageUploader value={customer.photo_with_reseller_base64 || existing.photo_with_reseller_url} onChange={v => updC('photo_with_reseller_base64', v)} label="With Reseller" /></label>
          </div>
        </div>

        <div className="form-grid">
          <label className="field"><span>National ID — Front</span>
            <ImageUploader value={customer.id_front_base64 || existing.id_front_url} onChange={v => updC('id_front_base64', v)} label="ID Front" /></label>
          <label className="field"><span>National ID — Back</span>
            <ImageUploader value={customer.id_back_base64 || existing.id_back_url} onChange={v => updC('id_back_base64', v)} label="ID Back" /></label>
        </div>

        <div className="form-grid">
          <label className="field"><span>Device Photo (phone itself)</span>
            <ImageUploader value={customer.device_photo_base64 || existing.device_photo_url} onChange={v => updC('device_photo_base64', v)} label="Device" /></label>
          <div></div>
        </div>

        {[0, 1].map(i => (
          <div key={i}>
            <h3 style={{marginTop: 24}}>Guarantor {i + 1}</h3>
            <div className="form-grid">
              <div>
                <label className="field"><span>Full Name</span>
                  <input value={guarantors[i].full_name} onChange={e => updG(i, 'full_name', e.target.value)} /></label>
                <label className="field"><span>Phone</span>
                  <input value={guarantors[i].phone} onChange={e => updG(i, 'phone', e.target.value)} /></label>
                <label className="field"><span>National ID (NIN)</span>
                  <input value={guarantors[i].nin} onChange={e => updG(i, 'nin', e.target.value.toUpperCase())}
                    placeholder="CM8901234567890" /></label>
                <label className="field"><span>Relationship</span>
                  <input value={guarantors[i].relationship} onChange={e => updG(i, 'relationship', e.target.value)} /></label>
                <label className="field"><span>Occupation</span>
                  <input value={guarantors[i].occupation} onChange={e => updG(i, 'occupation', e.target.value)} /></label>
                <label className="field"><span>Address</span>
                  <textarea rows={2} value={guarantors[i].address} onChange={e => updG(i, 'address', e.target.value)} /></label>
              </div>
              <div>
                <label className="field"><span>Guarantor Photo</span>
                  <ImageUploader value={guarantors[i].photo || guarantors[i].existingPhoto} onChange={v => updG(i, 'photo', v)} label="Guarantor" /></label>
                <label className="field"><span>National ID Photo</span>
                  <ImageUploader value={guarantors[i].id_front || guarantors[i].existingId} onChange={v => updG(i, 'id_front', v)} label="Guarantor ID" /></label>
              </div>
            </div>
          </div>
        ))}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save KYC'}</button>
        </div>
      </form>
    </Modal>
  );
}
