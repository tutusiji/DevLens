/**
 * PasswordInput：密码输入框 + 可见性切换（眼睛图标）
 */
'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PasswordInput({
  className,
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  className?: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border/70 bg-background/80 px-4 pr-11 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none"
        aria-label={visible ? '隐藏密码' : '显示密码'}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
