import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <input id={id} className={`form-input ${error ? 'border-red-500/50' : ''} ${className}`} {...props} />
      {error && <p style={{ fontSize: 12, color: '#F2A8A8', marginTop: 4 }}>{error}</p>}
    </div>
  );
}
