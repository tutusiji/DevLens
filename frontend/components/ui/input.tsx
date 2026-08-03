'use client';

import * as React from 'react';
import { Input as HeroUIInput } from '@heroui/react/input';
import { cn } from '@/lib/utils';

/* ============================================
   Input 组件 - 基于 HeroUI Input
   保持 React.InputHTMLAttributes 的 value/onChange/
   placeholder/disabled/className 使用方式。
   ============================================ */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, onChange, ...props }, ref) => {
    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event),
      [onChange]
    );

    return (
      <HeroUIInput
        ref={ref}
        className={cn('w-full', className)}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
