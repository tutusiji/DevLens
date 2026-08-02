'use client';

import * as React from 'react';
import { Input as HeroUIInput } from '@heroui/react/input';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, onChange, ...props }, ref) => {
  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event), [onChange]);
  return (
    <HeroUIInput
      ref={ref}
      className={cn('w-full rounded-md', className)}
      onChange={handleChange}
      {...props}
    />
  );
});

Input.displayName = 'Input';
export { Input };
