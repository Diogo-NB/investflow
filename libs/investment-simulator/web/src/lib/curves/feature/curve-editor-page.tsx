import { useId, useState, type ReactNode } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldError,
  type UseFormReturn,
} from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { BusinessDateField } from '../../business-calendar/business-date-field';
import { useBusinessCalendar } from '../../business-calendar/use-business-calendar';
import { formatIsoDate } from '../../dates/calendar-date';
import type { EconomicIndex } from '../../offers/models/offer-terms';
import { ORIGIN_LABELS } from '../../offers/utils/offer-groups';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { DecimalInput } from '../../ui/decimal-input';
import type { ControlProps } from '../../ui/form-field';
import { FormField } from '../../ui/form-field';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  CopyIcon,
  CurveIcon,
  PlusIcon,
  SpinningRefreshIcon,
  SplitIcon,
  TrashIcon,
} from '../../ui/icons';
import { PageLabel } from '../../ui/page-label';
import { PageTitle } from '../../ui/page-title';
import {
  SelectField,
  type SelectGroup,
  type SelectOption,
} from '../../ui/select-field';
import {
  bareInput,
  fieldBox,
  primaryButton,
  quietButton,
  secondaryButton,
  surface,
} from '../../ui/styles';
import { useUnsavedChangesGuard } from '../../ui/use-unsaved-changes-guard';
import {
  CONVENTION_LABELS,
  INDEX_LABELS,
  INDEXES,
  isMonthly,
  VALUE_UNITS,
} from '../models/curve-terms';
import type { CurveDetail, CurveSummary } from '../models/curve.types';
import {
  blankRow,
  boundaryLimits,
  changesCurveValues,
  curveResolver,
  followEnd,
  followStart,
  hasRowContent,
  intervalRows,
  isNonBusinessDate,
  nextRow,
  removalPatch,
  rowsCoverage,
  splitRow,
  startFix,
  type IntervalRow,
  type CurveFormContext,
  type CurveFormValues,
  type RowPatch,
} from '../utils/curve-form';
import type { CurveSimulationsState } from './use-curve-details';
import { useCurveEditor } from './use-curve-editor';

type Editor = ReturnType<typeof useCurveEditor>;
type CurveForm = UseFormReturn<CurveFormValues, CurveFormContext>;

// Base UI keeps an empty value for the placeholder, so "none" needs its own.
const NO_BASE = 'NONE';

const INDEX_OPTIONS: SelectOption[] = INDEXES.map((index) => ({
  value: index,
  label: INDEX_LABELS[index],
  detail: CONVENTION_LABELS[index],
}));

// Curves arrive ordered by index and origin, so groups keep that order.
function baseGroups(
  curves: readonly CurveSummary[],
  index: EconomicIndex | '',
): SelectGroup[] {
  const groups = new Map<string, SelectOption[]>();
  for (const curve of curves) {
    if (index !== '' && curve.index !== index) continue;
    const label = `${INDEX_LABELS[curve.index]} · ${ORIGIN_LABELS[curve.origin]}`;
    groups.set(label, [
      ...(groups.get(label) ?? []),
      {
        value: curve.id,
        label: curve.name,
        detail: `${formatIsoDate(curve.coverage.startDate)} a ${formatIsoDate(curve.coverage.endDate)}`,
      },
    ]);
  }
  return [...groups].map(([label, options]) => ({ label, options }));
}

function ImpactNotice({ state }: { readonly state: CurveSimulationsState }) {
  if (state.status !== 'ready' || state.total === 0) return null;
  const count =
    state.total === 1
      ? 'A simulação que usa esta curva será recalculada.'
      : `As ${state.total} simulações que usam esta curva serão recalculadas.`;
  return (
    <p className="m-0 flex items-start gap-2 rounded-control border border-warning/40 bg-warning-soft p-3 text-sm text-warning motion-safe:animate-fade-in">
      <AlertTriangleIcon className="size-5 shrink-0" />
      {count}
    </p>
  );
}

// The column header names the field on wider screens; the label stays for
// assistive technology and narrow screens, with the row number.
function IntervalField({
  label,
  row,
  error,
  hint,
  action,
  children,
}: {
  readonly label: string;
  readonly row: number;
  readonly error: FieldError | undefined;
  readonly hint?: string;
  // A fix for the error, offered beneath it.
  readonly action?: ReactNode;
  readonly children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-medium sm:sr-only">
        {label}
        <span className="sr-only"> do intervalo {row}</span>
      </label>
      {children({
        id,
        'aria-describedby':
          [errorId, hintId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': Boolean(error),
      })}
      {error && (
        <p id={errorId} className="m-0 text-sm text-error">
          {error.message}
        </p>
      )}
      {action}
      {hint && (
        <p id={hintId} className="m-0 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function CoverageSummary({
  form,
  index,
}: {
  readonly form: CurveForm;
  readonly index: EconomicIndex;
}) {
  const rows = useWatch({ control: form.control, name: 'intervals' });
  const coverage = rowsCoverage(index, rows);
  const format = (isoDate: string) =>
    isMonthly(index)
      ? `${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`
      : formatIsoDate(isoDate);
  return (
    <p aria-live="polite" className="m-0 text-sm text-muted">
      {coverage
        ? `Cobertura: ${format(coverage.startDate)} a ${format(coverage.endDate)}.`
        : 'Cobertura: informe as datas de um intervalo.'}
    </p>
  );
}

/**
 * Re-checks the rules between rows, which are reported on starts, and the
 * fields already in error. Untouched fields of rows just added or restored
 * stay quiet until the next save.
 */
function revalidateRows(form: CurveForm, evenBeforeSaving = false) {
  if (!evenBeforeSaving && !form.formState.isSubmitted) return;
  const errors = form.formState.errors.intervals;
  const names = form
    .getValues('intervals')
    .flatMap((row, i) =>
      (['start', 'end', 'value'] as const)
        .filter(
          (field) =>
            errors?.[i]?.[field] !== undefined ||
            (field === 'start' && row.start.trim() !== ''),
        )
        .map((field) => `intervals.${i}.${field}` as const),
    );
  if (names.length > 0) void form.trigger(names);
}

// Stable, so React calls it only when the element mounts.
function focusOnMount(element: HTMLElement | null) {
  element?.focus();
}

export interface RowUndo {
  readonly message: string;
  // Remounts the notice when a newer change replaces it.
  readonly serial: number;
  // The row to focus once undone; removals also move focus to the notice.
  readonly focusRow: number | null;
}

const ROW_GRID =
  'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,10rem)_5.75rem]';

type Calendar = CurveFormContext['calendar'];

function IntervalsEditor({
  form,
  index,
  pending,
  calendar,
  remember,
  forget,
  undo,
  onUndo,
}: {
  readonly form: CurveForm;
  readonly index: EconomicIndex;
  readonly pending: boolean;
  readonly calendar: Calendar;
  // Offers to undo the change about to happen.
  readonly remember: (message: string, focusRow?: number) => void;
  // Any other edit withdraws that offer, so undoing never discards it.
  readonly forget: () => void;
  readonly undo: RowUndo | null;
  readonly onUndo: () => void;
}) {
  const intervals = useFieldArray({ control: form.control, name: 'intervals' });
  const watched = useWatch({ control: form.control, name: 'intervals' });
  // Right after rows are added, split or removed, the watched values lag the
  // field list for one render; the form's own values never do.
  const rows =
    watched.length === intervals.fields.length
      ? watched
      : form.getValues('intervals');
  const monthly = isMonthly(index);
  const errors = form.formState.errors.intervals;
  const listError = errors?.message ?? errors?.root?.message;
  const labels = monthly
    ? { start: 'Mês inicial', end: 'Mês final', value: 'Variação mensal' }
    : { start: 'Início', end: 'Fim', value: 'Taxa anual' };
  const formatBoundary = (value: string) =>
    monthly ? value : formatIsoDate(value);

  // Overlaps and gaps are reported on other rows than the one changed.
  const revalidate = () => revalidateRows(form);

  function apply(patch: RowPatch | null) {
    if (patch) {
      const name = `intervals.${patch.row}.${patch.field}` as const;
      form.setValue(name, patch.value, {
        shouldDirty: true,
        shouldValidate: form.getFieldState(name).isTouched,
      });
    }
    revalidate();
  }

  // Keeps the rows contiguous: an end moves the next start, a start moves
  // the previous end.
  function boundaryChanged(row: number, field: 'start' | 'end') {
    forget();
    const current = form.getValues('intervals');
    // An end now before the start is flagged at once, not on its next blur.
    if (field === 'start' && current[row].end !== '') {
      void form.trigger(`intervals.${row}.end`);
    }
    apply(
      field === 'end'
        ? followEnd(index, current, row, calendar)
        : followStart(index, current, row, calendar),
    );
  }

  function add() {
    forget();
    const current = form.getValues('intervals');
    const row = nextRow(index, current, calendar);
    // With dates guessed, the value is what is left to type.
    intervals.append(row, {
      focusName: `intervals.${current.length}.${row.start ? 'value' : 'start'}`,
    });
  }

  function split(row: number) {
    forget();
    const parts = splitRow(index, form.getValues(`intervals.${row}`), calendar);
    if (!parts) return;
    form.setValue(`intervals.${row}.end`, parts[0].end, { shouldDirty: true });
    intervals.insert(row + 1, parts[1], {
      focusName: `intervals.${row + 1}.value`,
    });
    revalidate();
  }

  function remove(row: number) {
    const current = form.getValues('intervals');
    const patch = removalPatch(index, current, row, calendar);
    remember(
      patch
        ? `Intervalo ${row + 1} removido; o anterior agora vai até ${formatBoundary(patch.value)}.`
        : row === 0 || row === current.length - 1
          ? `Intervalo ${row + 1} removido; a curva ficou mais curta.`
          : `Intervalo ${row + 1} removido.`,
      row,
    );
    if (patch) {
      form.setValue(`intervals.${patch.row}.${patch.field}`, patch.value, {
        shouldDirty: true,
      });
    }
    intervals.remove(row);
    revalidate();
  }

  function fixStart(row: number, start: string) {
    forget();
    form.setValue(`intervals.${row}.start`, start, {
      shouldDirty: true,
      shouldTouch: true,
    });
    boundaryChanged(row, 'start');
    revalidateRows(form, true);
  }

  return (
    <fieldset className="m-0 grid gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-medium">
        Intervalos{' '}
        <span className="font-normal text-muted">
          · {CONVENTION_LABELS[index].toLowerCase()}, início e fim inclusivos,
          sem {monthly ? 'meses' : 'dias úteis'} faltando
        </span>
      </legend>
      <div
        aria-hidden="true"
        className={`hidden gap-3 text-sm text-muted sm:grid ${ROW_GRID}`}
      >
        <span>{labels.start}</span>
        <span>{labels.end}</span>
        <span>{labels.value}</span>
      </div>
      <ol className="m-0 grid list-none gap-3 p-0">
        {intervals.fields.map((field, i) => {
          const rowErrors = errors?.[i];
          const row = rows[i];
          const fix = rowErrors?.start
            ? startFix(index, rows, i, calendar)
            : null;
          const canSplit = splitRow(index, row, calendar) !== null;
          const valueField = form.register(`intervals.${i}.value`);
          return (
            <li
              key={field.id}
              className={`grid gap-3 border-b border-border pb-3 last:border-b-0 sm:border-b-0 sm:pb-0 ${ROW_GRID}`}
            >
              {/* The labels already name the row for assistive technology. */}
              <p
                aria-hidden="true"
                className="m-0 text-sm font-semibold text-muted sm:hidden"
              >
                Intervalo {i + 1}
              </p>
              {(['start', 'end'] as const).map((boundary) => (
                <IntervalField
                  key={boundary}
                  label={labels[boundary]}
                  row={i + 1}
                  error={rowErrors?.[boundary]}
                  hint={
                    isNonBusinessDate(index, row[boundary], calendar)
                      ? 'Não é dia útil.'
                      : undefined
                  }
                  action={
                    boundary === 'start' &&
                    fix && (
                      <button
                        type="button"
                        className={`${quietButton} min-h-8 justify-self-start px-2 text-sm`}
                        onClick={() => fixStart(i, fix)}
                      >
                        Começar em {formatBoundary(fix)}
                      </button>
                    )
                  }
                >
                  {(control) => (
                    <Controller
                      control={form.control}
                      name={`intervals.${i}.${boundary}`}
                      render={({ field: date }) =>
                        monthly ? (
                          <div className={fieldBox}>
                            <input
                              {...control}
                              ref={date.ref}
                              value={date.value}
                              onChange={(event) => {
                                date.onChange(event.target.value);
                                void boundaryChanged(i, boundary);
                              }}
                              onBlur={date.onBlur}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="MM/AAAA"
                              maxLength={7}
                              className={`${bareInput} tabular-nums`}
                            />
                          </div>
                        ) : (
                          <BusinessDateField
                            {...control}
                            {...boundaryLimits(rows, i, boundary)}
                            ref={date.ref}
                            value={date.value}
                            onChange={(value) => {
                              date.onChange(value);
                              boundaryChanged(i, boundary);
                            }}
                            onBlur={date.onBlur}
                            disabled={pending}
                          />
                        )
                      }
                    />
                  )}
                </IntervalField>
              ))}
              <IntervalField
                label={labels.value}
                row={i + 1}
                error={rowErrors?.value}
              >
                {(control) => (
                  <DecimalInput
                    {...control}
                    {...valueField}
                    onChange={(event) => {
                      forget();
                      return valueField.onChange(event);
                    }}
                    // Monthly variations can be negative.
                    inputMode={monthly ? 'text' : 'decimal'}
                    suffix={VALUE_UNITS[index]}
                    // Neighboring periods usually have similar values.
                    placeholder={
                      rows[i - 1]?.value.trim() || (monthly ? '0,4' : '12,5')
                    }
                  />
                )}
              </IntervalField>
              <div className="flex gap-1 sm:self-start">
                <button
                  type="button"
                  aria-label={`Dividir intervalo ${i + 1} em dois`}
                  title="Dividir em dois"
                  className={`${quietButton} min-w-11 gap-1.5 px-2 sm:px-0`}
                  disabled={!canSplit}
                  onClick={() => split(i)}
                >
                  <SplitIcon className="size-5 shrink-0" />
                  <span aria-hidden="true" className="sm:hidden">
                    Dividir
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remover intervalo ${i + 1}`}
                  title="Remover intervalo"
                  className={`${quietButton} min-w-11 gap-1.5 px-2 text-error sm:px-0`}
                  disabled={intervals.fields.length === 1}
                  onClick={() => remove(i)}
                >
                  <TrashIcon className="size-5 shrink-0" />
                  <span aria-hidden="true" className="sm:hidden">
                    Remover
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {undo && (
        <div
          key={undo.serial}
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-bg py-1 pr-1 pl-3 text-sm motion-safe:animate-fade-in"
        >
          <span>{undo.message}</span>
          <button
            ref={undo.focusRow === null ? undefined : focusOnMount}
            type="button"
            className={quietButton}
            onClick={onUndo}
          >
            Desfazer
          </button>
        </div>
      )}
      {listError && (
        <p role="alert" className="m-0 text-sm text-error">
          {listError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={secondaryButton} onClick={add}>
          <PlusIcon className="size-4 shrink-0" />
          Adicionar intervalo
        </button>
        <CoverageSummary form={form} index={index} />
      </div>
    </fieldset>
  );
}

function BaseCurveField({
  editor,
  index,
  value,
  onChoose,
}: {
  readonly editor: Editor;
  readonly index: EconomicIndex | '';
  readonly value: string;
  readonly onChoose: (id: string) => void;
}) {
  const { state, copy } = editor.bases;
  return (
    <FormField
      label="Copiar intervalos de (opcional)"
      icon={CopyIcon}
      hint={
        copy === 'loading'
          ? 'Copiando intervalos…'
          : index === ''
            ? 'Escolher uma curva também define o índice.'
            : `Curvas de ${INDEX_LABELS[index]}.`
      }
      error={
        copy === 'failed'
          ? 'Não foi possível copiar os intervalos. Escolha a curva novamente.'
          : state.status === 'error'
            ? 'Não foi possível carregar as curvas.'
            : undefined
      }
    >
      {(control) =>
        state.status === 'error' ? (
          <button
            type="button"
            className={`${secondaryButton} justify-self-start`}
            disabled={state.retrying}
            onClick={editor.bases.retry}
          >
            {state.retrying ? 'Tentando…' : 'Tentar novamente'}
          </button>
        ) : (
          <SelectField
            {...control}
            value={value || NO_BASE}
            placeholder={
              state.status === 'loading' ? 'Carregando curvas…' : 'Nenhuma'
            }
            disabled={state.status !== 'ready' || copy === 'loading'}
            options={[{ value: NO_BASE, label: 'Nenhuma' }]}
            groups={
              state.status === 'ready' ? baseGroups(state.curves, index) : []
            }
            onValueChange={(next) => onChoose(next === NO_BASE ? '' : next)}
          />
        )
      }
    </FormField>
  );
}

function CurveEditorForm({
  editor,
  curve,
  initialValues,
  calendar,
}: {
  readonly editor: Editor;
  readonly curve: CurveDetail | null;
  readonly initialValues: CurveFormValues;
  readonly calendar: Calendar;
}) {
  // Edits are measured against the version the form started from, never a
  // later read.
  const [baseline] = useState(curve);
  const { save, listSearch } = editor;
  const form = useForm<CurveFormValues, CurveFormContext>({
    resolver: curveResolver,
    context: { calendar },
    defaultValues: initialValues,
    mode: 'onTouched',
  });
  const index = useWatch({ control: form.control, name: 'index' });
  // Only changes a calculation reads recalculate the simulations.
  const recalculates = useWatch({
    control: form.control,
    compute: (values) =>
      baseline !== null && changesCurveValues(baseline, values),
  });
  const [baseId, setBaseId] = useState('');
  // The last row removal or replacement, until another edit.
  const [undo, setUndo] = useState<
    | (RowUndo & {
        readonly index: CurveFormValues['index'];
        readonly intervals: IntervalRow[];
      })
    | null
  >(null);

  function remember(message: string, focusRow?: number) {
    const snapshot = {
      message,
      focusRow: focusRow ?? null,
      index: form.getValues('index'),
      intervals: form.getValues('intervals').map((row) => ({ ...row })),
    };
    setUndo((previous) => ({
      ...snapshot,
      serial: (previous?.serial ?? 0) + 1,
    }));
  }

  function forget() {
    if (undo) setUndo(null);
  }

  function restore() {
    if (!undo) return;
    form.setValue('index', undo.index, { shouldDirty: true });
    form.setValue('intervals', undo.intervals, { shouldDirty: true });
    revalidateRows(form);
    setUndo(null);
    // The restored rows mount after this render; the notice's button, which
    // had focus, is gone.
    const row = Math.min(undo.focusRow ?? 0, undo.intervals.length - 1);
    requestAnimationFrame(() => form.setFocus(`intervals.${row}.start`));
  }
  const { errors, isDirty } = form.formState;
  const blocker = useUnsavedChangesGuard(isDirty && !save.pending);
  const pending = save.pending;
  const problem = save.problem;

  function chooseIndex(next: EconomicIndex) {
    // Monthly and daily intervals are typed differently.
    if (index !== '' && isMonthly(next) !== isMonthly(index)) {
      const rows = form.getValues('intervals');
      if (hasRowContent(rows)) {
        remember(`Intervalos apagados ao trocar para ${INDEX_LABELS[next]}.`);
      }
      form.setValue('intervals', [blankRow()], { shouldDirty: true });
      form.clearErrors('intervals');
    }
    form.setValue('index', next, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    const base = editor.bases.state;
    if (
      base.status === 'ready' &&
      base.curves.find((candidate) => candidate.id === baseId)?.index !== next
    ) {
      setBaseId('');
    }
  }

  async function chooseBase(id: string) {
    setBaseId(id);
    if (!id) return;
    const source = await editor.bases.read(id);
    if (!source) return;
    const rows = intervalRows(source.index, source.intervals);
    if (hasRowContent(form.getValues('intervals'))) {
      remember(`Intervalos substituídos pelos de ${source.name}.`);
    } else {
      forget();
    }
    form.setValue('index', source.index, { shouldDirty: true });
    form.setValue('intervals', rows, { shouldDirty: true });
    form.clearErrors(['index', 'intervals']);
  }

  const submit = form.handleSubmit((values) => {
    setUndo(null);
    save.run(values, baseline, () => form.reset(values));
  });

  return (
    <>
      <form
        noValidate
        className={`${surface} grid max-w-4xl gap-4 p-6`}
        onSubmit={(event) => void submit(event)}
      >
        <fieldset disabled={pending} className="m-0 grid gap-4 border-0 p-0">
          <FormField label="Nome da curva" error={errors.name?.message}>
            {(control) => (
              <div className={fieldBox}>
                <input
                  {...control}
                  {...form.register('name')}
                  type="text"
                  maxLength={100}
                  placeholder="CDI otimista"
                  className={bareInput}
                />
              </div>
            )}
          </FormField>
          {baseline ? (
            <div className="grid content-start gap-1.5">
              <span className="text-sm font-medium">Índice</span>
              <span className="flex min-h-11 items-center">
                {INDEX_LABELS[baseline.index]}
                <span className="ml-1 text-sm text-muted">
                  · não muda depois de criado
                </span>
              </span>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="index"
                render={({ field, fieldState }) => (
                  <FormField
                    label="Índice"
                    hint="Não muda depois de criado."
                    error={fieldState.error?.message}
                  >
                    {(control) => (
                      <SelectField
                        {...control}
                        ref={field.ref}
                        value={field.value}
                        placeholder="Escolha o índice"
                        disabled={pending}
                        options={INDEX_OPTIONS}
                        onValueChange={(value) =>
                          chooseIndex(value as EconomicIndex)
                        }
                        onBlur={field.onBlur}
                      />
                    )}
                  </FormField>
                )}
              />
              <BaseCurveField
                editor={editor}
                index={index}
                value={baseId}
                onChoose={(id) => void chooseBase(id)}
              />
            </div>
          )}
          <FormField
            label="Descrição (opcional)"
            error={errors.description?.message}
          >
            {(control) => (
              <textarea
                {...control}
                {...form.register('description')}
                rows={2}
                maxLength={500}
                placeholder="Premissas desta trajetória"
                className="min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-fg placeholder:text-muted hover:border-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-error disabled:bg-bg disabled:text-muted"
              />
            )}
          </FormField>
          {index === '' ? (
            <p className="m-0 rounded-control border border-dashed border-border p-4 text-sm text-muted">
              Escolha o índice ou uma curva para copiar e informe os intervalos.
            </p>
          ) : (
            <IntervalsEditor
              // Daily and monthly rows are different inputs.
              key={isMonthly(index) ? 'monthly' : 'daily'}
              form={form}
              index={index}
              pending={pending}
              calendar={calendar}
              remember={remember}
              forget={forget}
              undo={undo}
              onUndo={restore}
            />
          )}
        </fieldset>

        {recalculates && <ImpactNotice state={editor.simulations} />}

        <div aria-live="polite">
          {problem && (
            <div role="alert" className="grid justify-items-start gap-2">
              <p className="m-0 text-sm text-error">
                {problem.conflict
                  ? 'Esta curva foi alterada em outro lugar. Recarregue para ver a versão salva; suas alterações nesta tela serão descartadas.'
                  : problem.message}
              </p>
              {problem.conflict && (
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => void save.reload()}
                >
                  Recarregar
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className={primaryButton}
            disabled={pending || (baseline !== null && !isDirty)}
          >
            {pending ? (
              <SpinningRefreshIcon className="size-5" />
            ) : baseline ? (
              <CheckCircleIcon className="size-5 shrink-0" />
            ) : (
              <PlusIcon className="size-5 shrink-0" />
            )}
            {pending ? 'Salvando…' : baseline ? 'Salvar' : 'Criar curva'}
          </button>
          <Link
            to={
              baseline
                ? `/curvas/${baseline.id}${listSearch}`
                : `/curvas${listSearch}`
            }
            className={secondaryButton}
          >
            Cancelar
          </Link>
        </div>
      </form>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="Descartar alterações?"
        description="As alterações desta curva ainda não foram salvas."
        cancelLabel="Continuar editando"
        confirmLabel="Descartar alterações"
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}

export function CurveEditorPage() {
  const { curveId } = useParams();
  const editor = useCurveEditor(curveId);
  const businessDays = useBusinessCalendar();
  const { setup, listSearch } = editor;
  const creating = curveId === undefined;

  return (
    <section aria-labelledby="curve-editor-title" className="grid gap-6">
      <title>
        {creating ? 'Nova curva | InvestFlow' : 'Editar curva | InvestFlow'}
      </title>
      <PageLabel icon={CurveIcon}>
        <Link to={`/curvas${listSearch}`} className="text-accent">
          Curvas
        </Link>
      </PageLabel>
      {setup.status === 'loading' && (
        <p role="status" className="m-0 text-muted">
          <span id="curve-editor-title">Carregando curva…</span>
        </p>
      )}
      {setup.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="curve-editor-title" className="m-0 text-xl font-semibold">
            Curva não encontrada
          </h1>
          <p className="m-0 text-muted">Ela pode ter sido excluída.</p>
          <Link to={`/curvas${listSearch}`} className={secondaryButton}>
            Ver curvas
          </Link>
        </div>
      )}
      {setup.status === 'read-only' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="curve-editor-title" className="m-0 text-xl font-semibold">
            {setup.curve.name}
          </h1>
          <p className="m-0 max-w-prose text-muted">
            Curvas do sistema não podem ser alteradas. Duplique para ter uma
            cópia sua e editá-la.
          </p>
          <Link
            to={`/curvas/${setup.curve.id}${listSearch}`}
            className={secondaryButton}
          >
            Ver curva
          </Link>
        </div>
      )}
      {setup.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="curve-editor-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir a curva
          </h1>
          <button
            type="button"
            className={secondaryButton}
            disabled={setup.retrying}
            onClick={editor.retrySetup}
          >
            {setup.retrying ? 'Tentando…' : 'Tentar novamente'}
          </button>
        </div>
      )}
      {setup.status === 'ready' && (
        <>
          <header>
            <PageTitle
              id="curve-editor-title"
              icon={CurveIcon}
              subtitle={
                setup.curve
                  ? 'As alterações valem para todas as simulações que usam esta curva.'
                  : 'A curva fica em Minhas e pode ser usada nas suas simulações.'
              }
            >
              {setup.curve ? `Editar ${setup.curve.name}` : 'Nova curva'}
            </PageTitle>
          </header>
          {businessDays.state.status === 'loading' && (
            <p role="status" className="m-0 text-muted">
              Carregando o calendário de dias úteis…
            </p>
          )}
          {businessDays.state.status === 'error' && (
            <div role="alert" className="grid justify-items-start gap-4">
              <p className="m-0">
                Não foi possível carregar o calendário de dias úteis.
              </p>
              <button
                type="button"
                className={secondaryButton}
                disabled={businessDays.state.retrying}
                onClick={businessDays.retry}
              >
                {businessDays.state.retrying ? 'Tentando…' : 'Tentar novamente'}
              </button>
            </div>
          )}
          {businessDays.state.status === 'ready' && (
            <CurveEditorForm
              // A new form for each curve and each reload; never per read, so
              // a refetch cannot discard unsaved input.
              key={`${setup.curve?.id ?? 'new'}:${setup.loadGeneration}`}
              editor={editor}
              curve={setup.curve}
              initialValues={setup.initialValues}
              calendar={businessDays.state.calendar}
            />
          )}
        </>
      )}
    </section>
  );
}
