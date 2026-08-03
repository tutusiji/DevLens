'use client';

import * as React from 'react';
import { Button as HeroUIButton } from '@heroui/react/button';
import { cn } from '@/lib/utils';

/* ============================================
   Button 组件 - 基于 HeroUI Button
   保持原有 API：variant, size, onClick, disabled, className
   内部映射到 HeroUI Button：onPress, isDisabled, variant, isIconOnly
   由 HeroUI 主题和纯色语义类提供配色
   ============================================ */

type OldVariant = 'default' | 'accent' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'success';
type OldSize = 'default' | 'sm' | 'lg' | 'icon';

type HeroVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'outline' | 'danger' | 'danger-soft';
type HeroSize = 'sm' | 'md' | 'lg';

interface VariantConfig {
  herouiVariant: HeroVariant;
  extraClass?: string;
}

/** 旧 variant -> HeroUI variant + 纯色语义样式 */
const variantConfig: Record<OldVariant, VariantConfig> = {
  /* 主按钮：HeroUI primary（项目主题已桥接 primary token） */
  default: {
    herouiVariant: 'primary',
    extraClass: 'shadow-md shadow-primary/15 hover:shadow-lg hover:shadow-primary/20',
  },
  /* 强调色按钮：琥珀纯色 */
  accent: {
    herouiVariant: 'primary',
    extraClass: 'bg-amber-500 text-white shadow-md shadow-amber-500/15 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/20',
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
  /* 次要按钮：HeroUI secondary + 现有玻璃材质 */
  secondary: {
    herouiVariant: 'secondary',
    extraClass: 'glass-light',
  },
  /* 危险按钮：HeroUI danger */
  destructive: {
    herouiVariant: 'danger',
    extraClass: 'shadow-md shadow-destructive/15 hover:shadow-lg hover:shadow-destructive/20',
  },
  /* 成功按钮：绿色纯色 */
  success: {
    herouiVariant: 'primary',
    extraClass: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/15 hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/20',
  },
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
        className={cn(config.extraClass, className)}
        style={style}
        {...(props as unknown as React.ComponentProps<typeof HeroUIButton>)}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
