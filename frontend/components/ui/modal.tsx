/**
 * Modal 模态弹窗
 * 基于 HeroUI Modal，提供受控 API：
 *   <Modal isOpen onClose size="md">
 *     <ModalHeader>标题</ModalHeader>
 *     <ModalBody>内容</ModalBody>
 *     <ModalFooter>底部操作</ModalFooter>
 *   </Modal>
 *
 * 尺寸：sm / md / lg，默认 md
 */
'use client';

import * as React from 'react';
import {
  Modal as HeroModal,
  ModalBackdrop,
  ModalBody,
  ModalCloseTrigger,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  ModalHeading,
} from '@heroui/react/modal';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg';

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  size?: ModalSize;
  children: React.ReactNode;
  hideCloseButton?: boolean;
  backdrop?: 'opaque' | 'blur' | 'transparent';
}

export function Modal({
  isOpen,
  onClose,
  size = 'md',
  children,
  hideCloseButton = false,
  backdrop = 'opaque',
}: ModalProps) {
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  return (
    <HeroModal isOpen={isOpen} onOpenChange={handleOpenChange}>
      <ModalBackdrop
        variant={backdrop === 'blur' ? 'blur' : backdrop === 'transparent' ? 'transparent' : 'opaque'}
        className="bg-black/40"
      >
        <ModalContainer>
          <ModalDialog className={cn('w-full', sizeClass[size], 'shadow-2xl')}>
            <div className="relative">
              {!hideCloseButton && (
                <ModalCloseTrigger className="absolute right-3 top-3 z-10">
                  <div
                    role="button"
                    aria-label="关闭"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </div>
                </ModalCloseTrigger>
              )}
              {children}
            </div>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </HeroModal>
  );
}

export { ModalHeader, ModalHeading, ModalBody, ModalFooter };
