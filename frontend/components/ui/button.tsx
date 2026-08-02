'use client';

import * as React from 'react';
import { Button as HeroUIButton } from '@heroui/react/button';
import { cn } from '@/lib/utils';

type OldVariant = 'default' | 'accent' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'success';
type OldSize = 'default' | 'sm' | 'lg' | 'icon';
type HeroVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline' | 'danger' | 'danger-soft';
type HeroSize = 'sm' | 'md' | 'lg';

const variantConfig: Record<OldVariant, { herouiVariant: HeroVariant; extraClass?: string }> = {
  default: { herouiVariant: 'primary', extraClass: 'shadow-none' },
  accent: { herouiVariant: 'primary' },
  outline: { herouiVariant: 'outline' },
  ghost: { herouiVariant: 'ghost' },
  secondary: { herouiVariant: 'secondary' },
  destructive: { herouiVariant: 'danger', extraClass: 'shadow-none' },
  success: { herouiVariant: 'secondary', extraClass: 'border border-success/40 text-success hover:bg-success/10' },
};

const sizeMap: Record<OldSize, { heroSize: HeroSize; isIconOnly: boolean }> = {
  default: { heroSize: 'md', isIconOnly: false },
  sm: { heroSize: 'sm', isIconOnly: false },
  lg: { heroSize: 'lg', isIconOnly: false },
  icon: { heroSize: 'md', isIconOnly: true },
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'value'> {
  variant?: OldVariant;
  size?: OldSize;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', onClick, disabled, style, ...props }, ref) => {
    const config = variantConfig[variant] ?? variantConfig.default;
    const sizeConfig = sizeMap[size] ?? sizeMap.default;
    return (
      <HeroUIButton
        ref={ref}
        variant={config.herouiVariant}
        size={sizeConfig.heroSize}
        isIconOnly={sizeConfig.isIconOnly}
        isDisabled={disabled}
        onPress={onClick as never}
        className={cn('rounded-md font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1', config.extraClass, className)}
        style={style}
        {...(props as unknown as React.ComponentProps<typeof HeroUIButton>)}
      />
    );
  }
);

Button.displayName = 'Button';
export { Button };
