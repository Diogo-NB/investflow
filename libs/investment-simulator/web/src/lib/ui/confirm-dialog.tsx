import { AlertDialog } from '@base-ui/react/alert-dialog';
import type { ReactNode } from 'react';
import { dangerButton, primaryButton, secondaryButton } from './styles';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: ReactNode;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly destructive?: boolean;
  readonly pending?: boolean;
  readonly error?: string;
}

/** A confirmation with cancel first; it stays open while the action is pending. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  destructive = false,
  pending = false,
  error,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-fg opacity-30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 grid w-md max-w-[calc(100vw-2rem)] -translate-1/2 gap-4 rounded-surface border border-border bg-surface p-6 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <AlertDialog.Title className="m-0 text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-muted">
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="m-0 text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog.Close className={secondaryButton} disabled={pending}>
              {cancelLabel}
            </AlertDialog.Close>
            <button
              type="button"
              className={destructive ? dangerButton : primaryButton}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
