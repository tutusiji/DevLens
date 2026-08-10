/**
 * ConfirmDialog 统一二次确认弹窗
 * 替代 window.confirm：危险操作（删除/重置等）使用项目风格确认，支持 loading 态。
 */
'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal, ModalHeader, ModalHeading, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = true,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    if (loading) return;
    await onConfirm();
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="sm">
      <ModalHeader className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <AlertTriangle className="h-4.5 w-4.5" />
        </div>
        <ModalHeading className="text-base font-semibold">{title}</ModalHeading>
      </ModalHeader>
      {description && (
        <ModalBody>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </ModalBody>
      )}
      <ModalFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>{cancelText}</Button>
        <Button
          variant={danger ? 'destructive' : 'default'}
          disabled={loading}
          onClick={() => void handleConfirm()}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
