import React from 'react';

export function Modal({ title, children, onClose, width }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : {}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
