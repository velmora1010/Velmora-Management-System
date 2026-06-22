import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label className="text-sm font-semibold text-muted ml-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full bg-transparent border-2 border-border text-main rounded-lg px-4 py-2 text-base transition-velmora focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed ${
            error ? 'border-red-500' : ''
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
