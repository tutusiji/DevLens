'use client';

import * as React from 'react';
import { Button as HeroUIButton } from '@heroui/react/button';
import { cn } from '@/lib/utils';

/* ============================================
   Button 组件 - 基于 HeroUI Button
   保持原有 API：variant, size, onClick, disabled, className
   内部映射到 HeroUI Button：onPress, isDisabled, variant, isIconOnly
   通过 CSS 变量内联覆盖保持原有配色（渐变/半透明等）
   ============================================ */

type OldVariant = 'default' | 'accent' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'success';
type OldSize = 'default' | 'sm' | 'lg' | 'icon';

type HeroVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline' | 'danger' | 'danger-soft';
type HeroSize = 'sm' | 'md' | 'lg';

interface VariantConfig {
  herouiVariant: HeroVariant;
  style?: React.CSSProperties;
  extraClass?: string;
}

/** 旧 variant -> HeroUI variant + CSS 变量覆盖 */
const variantConfig: Record<OldVariant, VariantConfig> = {
  /* 主按钮：蓝色渐变（HeroUI primary 默认用 --accent 即琥珀色，需覆盖为 --primary 蓝色） */
  default: {
    herouiVariant: 'primary',
    style: {
      '--button-bg': 'transparent',
      '--button-bg-hover': 'transparent',
      '--button-bg-pressed': 'transparent',
      '--button-fg': 'var(--primary-foreground)',
      backgroundImage: 'linear-gradient(to right, oklch(0.68 0.2 245), oklch(0.58 0.18 265))',
    } as React.CSSProperties,
    extraClass: 'shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/25',
  },
  /* 强调色按钮：琥珀色渐变 */
  accent: {
    herouiVariant: 'primary',
    style: {
      '--button-bg': 'transparent',
      '--button-bg-hover': 'transparent',
      '--button-bg-pressed': 'transparent',
      '--button-fg': 'var(--accent-foreground)',
      backgroundImage: 'linear-gradient(to right, oklch(0.75 0.18 68), oklch(0.65 0.15 85))',
    } as React.CSSProperties,
    extraClass: 'shadow-lg shadow-accent/15 hover:shadow-xl hover:shadow-accent/25',
  },
  /* 玻璃质感按钮 */
  outline: {
    herouiVariant: 'outline',
    extraClass: 'glass-light',
  },
  /* 幽灵按钮（纯透明） */
  ghost: {
    herouiVariant: 'ghost',
  },
  /* 次要按钮：半透明紫色 */
  secondary: {
    herouiVariant: 'secondary',
    style: {
      '--button-bg': 'color-mix(in oklch, var(--secondary) 12%, transparent)',
      '--button-bg-hover': 'color-mix(in oklch, var(--secondary) 20%, transparent)',
      '--button-bg-pressed': 'color-mix(in oklch, var(--secondary) 20%, transparent)',
      '--button-fg': 'var(--secondary)',
    } as React.CSSProperties,
    extraClass: 'glass-light',
  },
  /* 危险按钮：红色渐变 */
  destructive: {
    herouiVariant: 'danger',
    style: {
      '--button-bg': 'transparent',
      '--button-bg-hover': 'transparent',
      '--button-bg-pressed': 'transparent',
      '--button-fg': 'white',
      backgroundImage: 'linear-gradient(to right, oklch(0.68 0.22 25), oklch(0.58 0.20 35))',
    } as React.CSSProperties,
    extraClass: 'shadow-lg shadow-destructive/15 hover:shadow-xl hover:shadow-destructive/25',
  },
  /* 成功按钮：绿色渐变 */
  success: {
    herouiVariant: 'primary',
    style: {
      '--button-bg': 'transparent',
      '--button-bg-hover': 'transparent',
      '--button-bg-pressed': 'transparent',
      '--button-fg': 'white',
      backgroundImage: 'linear-gradient(to right, oklch(0.72 0.18 155), oklch(0.62 0.16 170))',
    } as React.CSSProperties,
    extraClass: 'shadow-lg shadow-success/15 hover:shadow-xl hover:shadow-success/25',
  },
};

const sizeMap: Record<OldSize, { heroSize: HeroSize; isIconOnly: boolean }> = {
  default: { heroSize: 'md', isIconOnly: false },
  sm: { heroSize: 'sm', isIconOnly: false },
  lg: { heroSize: 'lg', isIconOnly: false },
  icon: { heroSize: 'md', isIconOnly: true },
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
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
        className={cn(config.extraClass, className)}
        style={{ ...config.style, ...style }}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
