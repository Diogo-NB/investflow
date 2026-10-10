import type { ComponentProps } from 'react';
import { bareInput, fieldBox } from './styles';

interface DecimalInputProps
  extends Omit<ComponentProps<'input'>, 'type' | 'className'> {
  // Visual unit around the number; the field label also names it.
  readonly prefix?: string;
  readonly suffix?: string;
}

/** A Brazilian-notation number input; the value stays the typed text. */
export function DecimalInput({ prefix, suffix, ...input }: DecimalInputProps) {
  return (
    <div className={fieldBox}>
      {prefix && (
        <span aria-hidden="true" className="pl-3 text-muted">
          {prefix}
        </span>
      )}
      <input
        {...input}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`${bareInput} text-right tabular-nums`}
      />
      {suffix && (
        <span aria-hidden="true" className="pr-3 whitespace-nowrap text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}
