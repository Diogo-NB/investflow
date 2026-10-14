import { useId, type ReactNode } from 'react';
import type { IconComponent } from './icons';

export interface ControlProps {
  readonly id: string;
  readonly 'aria-describedby': string | undefined;
  readonly 'aria-invalid': boolean;
}

interface FormFieldProps {
  readonly label: string;
  // The canonical icon of the aggregate the field chooses.
  readonly icon?: IconComponent;
  readonly hint?: ReactNode;
  readonly error?: string;
  readonly children: (control: ControlProps) => ReactNode;
}

export function FormField({
  label,
  icon: Icon,
  hint,
  error,
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="grid content-start gap-1.5">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-sm font-medium text-fg"
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted" />}
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': Boolean(error),
      })}
      {error && (
        <p id={errorId} className="m-0 text-sm text-error">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="m-0 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
