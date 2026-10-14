import { Popover } from '@base-ui/react/popover';
import { useState, type Ref } from 'react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import {
  formatIsoDate,
  isIsoDate,
  isoToLocalDate,
  localDateToIso,
  parseBrazilianDate,
  todayInSaoPaulo,
} from '../dates/calendar-date';
import type { ControlProps } from './form-field';
import { bareInput, fieldBox } from './styles';

interface DateFieldProps extends ControlProps {
  // An ISO calendar date, or the raw text while the typed date is invalid.
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
  readonly ref?: Ref<HTMLInputElement>;
  // Calendar days that cannot be picked (they can still be typed).
  readonly isDateUnavailable?: (isoDate: string) => boolean;
  // Inclusive ISO bounds of the days the calendar offers; it opens within
  // them and cannot leave their months.
  readonly min?: string;
  readonly max?: string;
  // Where an empty calendar opens; today when absent or out of bounds.
  readonly openTo?: string;
}

export function DateField({
  value,
  onChange,
  onBlur,
  disabled,
  ref,
  isDateUnavailable,
  min,
  max,
  openTo,
  ...control
}: DateFieldProps) {
  // Text being typed; null shows the value itself.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Set on every opening: the calendar stays mounted between openings, so a
  // starting month would keep showing the month of an earlier opening.
  const [month, setMonth] = useState<Date | undefined>(undefined);
  const valid = isIsoDate(value);
  // A value set from outside (a filled offer, the calendar) replaces the draft.
  const text =
    draft !== null && (!valid || parseBrazilianDate(draft) === value)
      ? draft
      : valid
        ? formatIsoDate(value)
        : value;
  const outside = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);
  // The selected day when it is allowed, else the preferred day, else today
  // moved within the bounds.
  const today = todayInSaoPaulo();
  const opening =
    valid && !outside(value)
      ? value
      : openTo !== undefined && isIsoDate(openTo) && !outside(openTo)
        ? openTo
        : min !== undefined && today < min
          ? min
          : max !== undefined && today > max
            ? max
            : today;

  return (
    <div className={fieldBox}>
      <input
        ref={ref}
        {...control}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(
            parseBrazilianDate(event.target.value) ?? event.target.value,
          );
        }}
        onBlur={() => {
          if (parseBrazilianDate(text)) setDraft(null);
          onBlur?.();
        }}
        className={`${bareInput} tabular-nums`}
      />
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (next) setMonth(isoToLocalDate(opening));
          setOpen(next);
        }}
      >
        <Popover.Trigger
          disabled={disabled}
          aria-label="Escolher no calendário"
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-control text-muted hover:text-accent disabled:cursor-default"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="4.5" width="14" height="12.5" rx="1.5" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
          </svg>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={8} align="end" className="z-20">
            <Popover.Popup className="origin-(--transform-origin) rounded-surface border border-border bg-surface p-3 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
              <DayPicker
                mode="single"
                locale={ptBR}
                autoFocus
                captionLayout="dropdown"
                startMonth={min ? isoToLocalDate(min) : new Date(2000, 0)}
                endMonth={max ? isoToLocalDate(max) : new Date(2060, 11)}
                selected={valid ? isoToLocalDate(value) : undefined}
                month={month}
                onMonthChange={setMonth}
                disabled={(date: Date) => {
                  const iso = localDateToIso(date);
                  return outside(iso) || Boolean(isDateUnavailable?.(iso));
                }}
                onSelect={(date) => {
                  if (!date) return;
                  setDraft(null);
                  onChange(localDateToIso(date));
                  setOpen(false);
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
