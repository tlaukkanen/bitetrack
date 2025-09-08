import React from 'react';
import { GiKnifeFork } from 'react-icons/gi';

interface SpinnerProps {
  size?: number;
  className?: string;
  title?: string;
}

export default function Spinner({ size = 16, className = '', title = 'Loading' }: SpinnerProps) {
  return (
    <GiKnifeFork
      size={size}
      className={`animate-spin text-emerald-600 ${className}`}
      aria-label={title}
      role="status"
    />
  );
}
