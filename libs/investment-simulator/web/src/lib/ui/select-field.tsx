import { Select } from '@base-ui/react/select';
import type { Ref } from 'react';
import type { ControlProps } from './form-field';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly disabled?: boolean;
}

export interface SelectGroup {
  readonly label: string;
  readonly options: readonly SelectOption[];
}

// Ungrouped options render before the groups.
type SelectFieldItems =
  | {
      readonly options: readonly SelectOption[];
      readonly groups?: readonly SelectGroup[];
    }
  | { readonly groups: readonly SelectGroup[]; readonly options?: never };

type SelectFieldProps = ControlProps &
  SelectFieldItems & {
    readonly value: string;
    readonly placeholder: string;
    readonly onValueChange: (value: string) => void;
    readonly onBlur?: () => void;
    readonly disabled?: boolean;
    readonly ref?: Ref<HTMLButtonElement>;
  };

export function SelectField({
  value,
  options,
  groups,
  placeholder,
  onValueChange,
  onBlur,
  disabled,
  ref,
  ...control
}: SelectFieldProps) {
  const all = [
    ...(options ?? []),
    ...(groups ?? []).flatMap((group) => group.options),
  ];
  return (
    <Select.Root
      items={all.map(({ value, label }) => ({ value, label }))}
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
        <Select.Icon
          aria-hidden="true"
          className="text-muted transition-transform duration-150 in-data-popup-open:rotate-180"
        >
          ▾
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-20 outline-none">
          <Select.Popup className="max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-control border border-border bg-surface py-1 text-fg outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Select.List>
              {options?.map((option) => (
                <SelectItem key={option.value} option={option} />
              ))}
              {groups?.map((group) => (
                <Select.Group key={group.label}>
                  <Select.GroupLabel className="px-3 pt-2 pb-1 text-sm font-semibold text-muted">
                    {group.label}
                  </Select.GroupLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} option={option} />
                  ))}
                </Select.Group>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function SelectItem({ option }: { readonly option: SelectOption }) {
  return (
    <Select.Item
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
          <span className="text-sm text-muted">{option.detail}</span>
        )}
      </span>
    </Select.Item>
  );
}
