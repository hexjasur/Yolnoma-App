import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({ label, error, id, className = '', ...props }: TextareaProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <textarea
        id={id}
        className={`form-textarea ${error ? 'border-red-500/50' : ''} ${className}`}
        {...props}
      />
      {error && <p style={{ fontSize: 12, color: '#F2A8A8', marginTop: 4 }}>{error}</p>}
    </div>
  );
}
