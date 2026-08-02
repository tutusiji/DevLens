/**
 * Sheet 侧滑抽屉
 * 基于 HeroUI Drawer，保留既有受控 Sheet API，
 * 并导出 SheetContent/SheetHeader/SheetTitle/SheetTrigger/SheetClose。
 */
'use client';

import * as React from 'react';
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerDialog,
  DrawerHeader,
  DrawerHeading,
  DrawerRoot,
  DrawerTrigger,
} from '@heroui/react/drawer';
import { cn } from '@/lib/utils';

type SheetSide = 'right' | 'left';
type SheetWidth = 'sm' | 'md' | 'lg';

const widthClass: Record<SheetWidth, string> = {
  sm: 'w-full max-w-sm',
  md: 'w-full max-w-md',
  lg: 'w-full max-w-lg',
};

export interface SheetProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: SheetSide;
  width?: SheetWidth;
  className?: string;
}

/**
 * HeroUI DrawerContent 的兼容包装。
 * 对外的 className 应用于实际滑出的 panel，而非全屏定位容器。
 */
export interface SheetContentProps
  extends Omit<React.ComponentProps<typeof DrawerContent>, 'children' | 'placement' | 'className'> {
  children: React.ReactNode;
  className?: string;
  side?: SheetSide;
}

function SheetContent({ children, className, side = 'right', ...props }: SheetContentProps) {
  return (
    <DrawerBackdrop variant="blur">
      <DrawerContent placement={side} {...props}>
        <DrawerDialog className={className}>{children}</DrawerDialog>
      </DrawerContent>
    </DrawerBackdrop>
  );
}

function Sheet({
  open,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  side = 'right',
  width = 'md',
  className,
}: SheetProps) {
  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      onOpenChange?.(isOpen);

      if (!isOpen) {
        onClose?.();
      }
    },
    [onClose, onOpenChange]
  );

  return (
    <DrawerRoot isOpen={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={side}
        className={cn('text-foreground', widthClass[width], className)}
        aria-label={title ?? '侧边抽屉'}
      >
        {(title || description) && (
          <DrawerHeader className="border-b border-border pb-4 pr-10">
            {title && <DrawerHeading className="font-mono text-lg font-semibold">{title}</DrawerHeading>}
            {description && <p className="text-sm text-foreground/70">{description}</p>}
          </DrawerHeader>
        )}
        <DrawerCloseTrigger aria-label="关闭" />
        <DrawerBody className="pt-5 text-foreground">{children}</DrawerBody>
      </SheetContent>
    </DrawerRoot>
  );
}

const SheetHeader = DrawerHeader;
const SheetTitle = DrawerHeading;
const SheetTrigger = DrawerTrigger;
const SheetClose = DrawerCloseTrigger;

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose };
