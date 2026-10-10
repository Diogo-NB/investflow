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
  // The year of the month the calendar shows, as it opens and navigates.
  readonly onVisibleYearChange?: (year: number) => void;
}

export function DateField({
  value,
  onChange,
  onBlur,
  disabled,
  ref,
  isDateUnavailable,
  onVisibleYearChange,
  ...control
}: DateFieldProps) {
  // Text being typed; null shows the value itself.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const valid = isIsoDate(value);
  // A value set from outside (a filled offer, the calendar) replaces the draft.
  const text =
    draft !== null && (!valid || parseBrazilianDate(draft) === value)
      ? draft
      : valid
        ? formatIsoDate(value)
        : value;

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
          setOpen(next);
          if (next) {
            onVisibleYearChange?.(
              Number((valid ? value : todayInSaoPaulo()).slice(0, 4)),
            );
          }
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
            <Popover.Popup className="rounded-surface border border-border bg-surface p-3 text-fg outline-none">
              <DayPicker
                mode="single"
                locale={ptBR}
                autoFocus
                captionLayout="dropdown"
                startMonth={new Date(2000, 0)}
                endMonth={new Date(2060, 11)}
                selected={valid ? isoToLocalDate(value) : undefined}
                defaultMonth={valid ? isoToLocalDate(value) : undefined}
                onMonthChange={(month) =>
                  onVisibleYearChange?.(month.getFullYear())
                }
                disabled={
                  isDateUnavailable
                    ? (date: Date) => isDateUnavailable(localDateToIso(date))
                    : undefined
                }
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
