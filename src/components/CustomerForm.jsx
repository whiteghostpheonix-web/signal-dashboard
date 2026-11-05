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
const emptyGuarantor = (slot) => ({ slot, full_name: '', phone: '', relationship: '' });

export function CustomerForm({ imei, onClose, onSuccess, toast }) {
  const [customer, setCustomer] = useState(emptyCustomer);
  const [existing, setExisting] = useState({});
  const [guarantors, setGuarantors] = useState([emptyGuarantor(1), emptyGuarantor(2)]);
  const [busy, setBusy] = useState(false);
  const [ninStatus, setNinStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/api/customers/${encodeURIComponent(imei)}`);
        if (r.customer) {
          setCustomer({ ...emptyCustomer,
            full_name: r.customer.full_name || '', phone: r.customer.phone || '',
            nin: r.customer.nin || '', dob: r.customer.dob || '',
            address: r.customer.address || '', occupation: r.customer.occupation || '',
            monthly_income: r.customer.monthly_income ?? '' });
          setExisting({
            photo_url: r.customer.photo_url, photo_with_reseller_url: r.customer.photo_with_reseller_url,
            device_photo_url: r.customer.device_photo_url, id_front_url: r.customer.id_front_url,
            id_back_url: r.customer.id_back_url,
          });
        }
        setGuarantors([1, 2].map(slot => {
          const record = r.guarantors?.find(item => item.slot === slot);
          return { ...emptyGuarantor(slot), full_name: record?.full_name || '',
            phone: record?.phone || '', relationship: record?.relationship || '' };
        }));
      } catch (_) {
        // The form remains available for a new customer if no saved record exists.
      }
    })();
  }, [imei]);

  async function checkNin(nin) {
    if (!nin || nin.length < 14) { setNinStatus(null); return; }
    try {
      const result = await api('/api/validate-nin', { method: 'POST', body: JSON.stringify({ nin }) });
      setNinStatus(result.valid ? 'valid' : `invalid: ${result.reason}`);
    } catch (_) { setNinStatus('error'); }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/api/customers', { method: 'POST', body: JSON.stringify({
        imei, full_name: customer.full_name, phone: customer.phone, nin: customer.nin,
        dob: customer.dob, address: customer.address, occupation: customer.occupation,
        monthly_income: customer.monthly_income || null,
        photo_base64: customer.photo_base64, photo_with_reseller_base64: customer.photo_with_reseller_base64,
        device_photo_base64: customer.device_photo_base64,
        id_front_base64: customer.id_front_base64, id_back_base64: customer.id_back_base64,
      }) });
      for (const guarantor of guarantors) {
        await api(`/api/customers/${encodeURIComponent(imei)}/guarantors`, {
          method: 'POST',
          body: JSON.stringify({
            slot: guarantor.slot,
            full_name: guarantor.full_name,
            phone: guarantor.phone,
            relationship: guarantor.relationship,
          }),
        });
      }
      toast('Customer and guarantor details saved', 'success');
      onSuccess(); onClose();
    } catch (error) {
      toast('KYC rejected: ' + error.message, 'error');
    } finally { setBusy(false); }
  }

  const updC = (field, value) => setCustomer(current => ({ ...current, [field]: value }));
  const updG = (index, field, value) => setGuarantors(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item));

  return (
    <Modal title={`Customer KYC — ${imei}`} onClose={onClose} width={850}>
      <form onSubmit={submit}>
        <h3 className="form-section-title">Customer Information</h3>
        <div className="form-grid">
          <div>
            <label className="field"><span>Full Name *</span>
              <input value={customer.full_name} required onChange={event => updC('full_name', event.target.value)} /></label>
            <label className="field"><span>Phone</span>
              <input type="tel" value={customer.phone} onChange={event => updC('phone', event.target.value)} /></label>
            <label className="field"><span>National ID (NIN) *</span>
              <input value={customer.nin} onChange={event => updC('nin', event.target.value.toUpperCase())}
                onBlur={event => checkNin(event.target.value)} placeholder="CM8901234567890" />
              {ninStatus === 'valid' && <small className="field-status-success">✅ Valid Uganda NIN</small>}
              {ninStatus && ninStatus !== 'valid' && <small className="field-status-error">{ninStatus}</small>}
              {!ninStatus && <small className="field-hint">Format: CM/CF + 12 characters</small>}
            </label>
            <label className="field"><span>Date of Birth</span>
              <input type="date" value={customer.dob} onChange={event => updC('dob', event.target.value)} /></label>
            <label className="field"><span>Occupation</span>
              <input value={customer.occupation} onChange={event => updC('occupation', event.target.value)} placeholder="e.g. Teacher, Trader, Farmer" /></label>
            <label className="field"><span>Monthly Income (UGX)</span>
              <input type="number" min="0" value={customer.monthly_income} onChange={event => updC('monthly_income', event.target.value)} /></label>
            <label className="field"><span>Address</span>
              <textarea rows={2} value={customer.address} onChange={event => updC('address', event.target.value)} /></label>
          </div>
          <div className="capture-grid">
            <label className="field"><span>Customer Photo</span>
              <ImageUploader value={customer.photo_base64 || existing.photo_url} onChange={value => updC('photo_base64', value)} label="Customer" /></label>
            <label className="field"><span>Photo With Retailer</span>
              <ImageUploader value={customer.photo_with_reseller_base64 || existing.photo_with_reseller_url} onChange={value => updC('photo_with_reseller_base64', value)} label="With retailer" /></label>
          </div>
        </div>

        <div className="capture-grid capture-grid-wide">
          <label className="field"><span>National ID — Front</span>
            <ImageUploader value={customer.id_front_base64 || existing.id_front_url} onChange={value => updC('id_front_base64', value)} label="ID front" /></label>
          <label className="field"><span>National ID — Back</span>
            <ImageUploader value={customer.id_back_base64 || existing.id_back_url} onChange={value => updC('id_back_base64', value)} label="ID back" /></label>
          <label className="field"><span>Device Photo (phone itself)</span>
            <ImageUploader value={customer.device_photo_base64 || existing.device_photo_url} onChange={value => updC('device_photo_base64', value)} label="Device" /></label>
        </div>

        {guarantors.map((guarantor, index) => (
          <section className="guarantor-section" key={guarantor.slot}>
            <h3 className="form-section-title">Guarantor {index + 1}</h3>
            <div className="form-grid guarantor-fields">
              <label className="field"><span>Full Name</span>
                <input value={guarantor.full_name} onChange={event => updG(index, 'full_name', event.target.value)} /></label>
              <label className="field"><span>Phone / Contact</span>
                <input type="tel" value={guarantor.phone} onChange={event => updG(index, 'phone', event.target.value)} /></label>
              <label className="field"><span>Relationship to Customer</span>
                <input value={guarantor.relationship} onChange={event => updG(index, 'relationship', event.target.value)} placeholder="e.g. Parent, spouse, friend" /></label>
            </div>
          </section>
        ))}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save KYC'}</button>
        </div>
      </form>
    </Modal>
  );
}
