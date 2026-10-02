import React, { useEffect } from 'react';

function Toast({ id, message, type, remove }) {
  useEffect(() => {
    const t = setTimeout(() => remove(id), 4000);
    return () => clearTimeout(t);
  }, [id, remove]);
  return <div className={`toast toast-${type}`} onClick={() => remove(id)}>{message}</div>;
}

export function ToastContainer({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => <Toast key={t.id} {...t} remove={remove} />)}
    </div>
  );
}
