import { Select } from '@base-ui/react/select';
import type { Ref } from 'react';
import type { ControlProps } from './form-field';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly disabled?: boolean;
}

interface SelectFieldProps extends ControlProps {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly placeholder: string;
  readonly onValueChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function SelectField({
  value,
  options,
  placeholder,
  onValueChange,
  onBlur,
  disabled,
  ref,
  ...control
}: SelectFieldProps) {
  return (
    <Select.Root
      items={options.map(({ value, label }) => ({ value, label }))}
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? '')}
      disabled={disabled}
    >
      <Select.Trigger
        ref={ref}
        {...control}
        onBlur={onBlur}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 text-left text-base text-fg outline-none hover:border-muted focus-visible:border-accent aria-invalid:border-error data-disabled:cursor-default data-disabled:bg-bg data-disabled:text-muted"
      >
        <Select.Value
          placeholder={placeholder}
          className="min-w-0 truncate data-placeholder:text-muted"
        />
        <Select.Icon aria-hidden="true" className="text-muted">
          ▾
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-20 outline-none">
          <Select.Popup className="max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto rounded-control border border-border bg-surface py-1 text-fg outline-none">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="grid min-h-11 cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2 outline-none select-none data-disabled:cursor-default data-disabled:text-muted data-highlighted:bg-accent-soft"
                >
                  <Select.ItemIndicator className="col-start-1 text-accent">
                    ✓
                  </Select.ItemIndicator>
                  <span className="col-start-2 grid">
                    <Select.ItemText>{option.label}</Select.ItemText>
                    {option.detail && (
                      <span className="text-sm text-muted">
                        {option.detail}
                      </span>
                    )}
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
