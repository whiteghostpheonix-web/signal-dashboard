import React, { useRef } from 'react';

export function ImageUploader({ value, onChange, label = 'Photo' }) {
  const ref = useRef(null);
  function pick() { ref.current?.click(); }
  function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }
  return (
    <div className="image-uploader">
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handle} />
      <div className="preview" onClick={pick}>
        {value ? <img src={value} alt={label} />
          : <div className="placeholder">📷<br/>Tap to add {label.toLowerCase()}</div>}
      </div>
      {value && (
        <button type="button" className="btn btn-sm" style={{marginTop: 8}} onClick={() => onChange(null)}>
          Remove
        </button>
      )}
    </div>
  );
}
