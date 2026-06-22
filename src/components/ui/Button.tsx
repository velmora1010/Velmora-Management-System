import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-velmora focus:outline-none rounded-lg font-sans";
  
  const variants = {
    primary: "bg-btn text-btn-text hover:bg-btn-hover shadow-velmora hover:shadow-velmora-hover",
    outline: "border-2 border-btn text-btn hover:bg-btn hover:text-btn-text",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-velmora hover:shadow-velmora-hover",
  };

  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-5 text-base",
    lg: "h-14 px-8 text-lg",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
