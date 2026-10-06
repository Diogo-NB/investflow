import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  disabled,
  form,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OffersApi } from '../api/offers-api';
import {
  Offer,
  OfferFormModel,
  OperationState,
  RemunerationKind,
} from '../models/offer.type';
import {
  emptyOfferModel,
  isCalendarDate,
  modelChanged,
  offerToModel,
  percentageToRate,
  remunerationOptions,
  formatRemuneration,
  toCreateOffer,
  toUpdateOffer,
} from '../utils/offer-values';
import { offerError } from '../utils/offer-errors';

@Injectable()
export class OfferEditorState {
  private readonly api = inject(OffersApi);
  private readonly destroy = inject(DestroyRef);
  private readonly original = signal<Offer | undefined>(undefined);
  private readonly baseline = signal(emptyOfferModel());
  private readonly model = signal(emptyOfferModel());
  private readonly operationState = signal<OperationState>({ status: 'idle' });
  readonly operation = this.operationState.asReadonly();
  readonly values = this.model.asReadonly();
  readonly editing = computed(() => !!this.original());
  readonly dirty = computed(() => modelChanged(this.model(), this.baseline()));
  readonly pending = computed(() => this.operation().status === 'pending');
  readonly remuneration = computed(() =>
    remunerationOptions.find(
      ({ value }) => value === this.model().remunerationKind,
    ),
  );
  readonly preview = computed(() => {
    const model = this.model();
    const rate = percentageToRate(model.percentage);
    return rate && model.remunerationKind
      ? formatRemuneration({ kind: model.remunerationKind, rate })
      : '';
  });
  readonly form = form(this.model, (path) => {
    required(path.titleType, { message: 'Selecione o tipo de título.' });
    required(path.issuerId, { message: 'Selecione o emissor.' });
    required(path.maturityDate, { message: 'Informe o vencimento.' });
    validate(path.maturityDate, ({ value }) =>
      value() && !isCalendarDate(value())
        ? { kind: 'date', message: 'Informe uma data válida.' }
        : undefined,
    );
    required(path.redemptionKind, { message: 'Selecione o resgate.' });
    required(path.remunerationKind, { message: 'Selecione a remuneração.' });
    required(path.percentage, { message: 'Informe o percentual contratado.' });
    validate(path.percentage, ({ value }) =>
      value() && !percentageToRate(value())
        ? {
            kind: 'rate',
            message:
              'Use um decimal maior que zero, com até 28 casas decimais, sem separador de milhares.',
          }
        : undefined,
    );
    disabled(path, () => this.pending());
  });

  initialize(offer?: Offer): void {
    this.original.set(offer);
    const model = offer ? offerToModel(offer) : emptyOfferModel();
    this.baseline.set(model);
    this.form().reset(model);
  }

  changeRemuneration(kind: RemunerationKind | ''): void {
    this.model.update((model) => ({
      ...model,
      remunerationKind: kind,
      percentage: '',
    }));
  }

  focusInvalid(): void {
    for (const key of Object.keys(this.model()) as Array<
      keyof OfferFormModel
    >) {
      if (this.form[key]().invalid()) {
        this.form[key]().focusBoundControl();
        return;
      }
    }
  }

  async save(): Promise<string | undefined> {
    if (
      this.pending() ||
      this.operation().status === 'success' ||
      (this.editing() && !this.dirty())
    )
      return undefined;
    let savedId: string | undefined;
    await submit(this.form, async () => {
      const model = this.model();
      const original = this.original();
      this.operationState.set({ status: 'pending' });
      try {
        if (original) {
          await firstValueFrom(
            this.api
              .update(original.id, toUpdateOffer(model, original))
              .pipe(takeUntilDestroyed(this.destroy)),
          );
          savedId = original.id;
        } else {
          const result = await firstValueFrom(
            this.api
              .create(toCreateOffer(model))
              .pipe(takeUntilDestroyed(this.destroy)),
          );
          savedId = result.id;
        }
        this.baseline.set({ ...model });
        this.operationState.set({ status: 'success', id: savedId });
      } catch (error: unknown) {
        if (!this.destroy.destroyed)
          this.operationState.set({
            status: 'error',
            message: offerError(error, 'save'),
          });
      }
    });
    if (this.form().invalid()) this.focusInvalid();
    return savedId;
  }
}
