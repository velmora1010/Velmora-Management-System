import React, { useState } from 'react';
import { getInitials } from '../../utils/avatar';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  roundedClassName?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  roundedClassName = 'rounded-2xl',
}) => {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(name);

  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-9 h-9 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg font-bold',
    xl: 'w-20 h-20 text-xl font-bold',
  }[size];

  // If no source is provided or image loading encounters an error, render initials avatar
  if (!src || hasError) {
    return (
      <div
        className={`${sizeClasses} ${roundedClassName} bg-[#EBF3FA] text-[#206DA6] font-bold flex items-center justify-center select-none shadow-xs border border-blue-100 flex-shrink-0 ${className}`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      className={`${sizeClasses} ${roundedClassName} object-cover flex-shrink-0 ${className}`}
    />
  );
};

export default Avatar;
