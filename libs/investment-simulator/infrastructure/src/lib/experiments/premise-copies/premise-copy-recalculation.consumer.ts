import { Logger } from '@nestjs/common';
import {
  RecalculateCurveSimulationsCommand,
  RecalculateCurveSimulationsUseCase,
  RecalculateOfferSimulationsCommand,
  RecalculateOfferSimulationsUseCase,
} from '@investflow/investment-simulator-application';
import {
  EEconomicIndex,
  ETitleType,
} from '@investflow/investment-simulator-domain';
import { OnEvent } from '@investflow/shared-infrastructure';
import { z } from 'zod';
import type { CurveCopyRepository } from './curve-copy.repository';
import type { OfferCopyRepository } from './offer-copy.repository';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const offerContentPayload = z.object({
  eventId: z.uuid(),
  aggregateId: z.uuid(),
  revision: z.number().int().min(1),
  termsRevision: z.number().int().min(1),
  offer: z.object({
    titleType: z.enum(ETitleType).optional(),
    maturityDate: isoDate.optional(),
    redemptionKind: z.enum(['AT_MATURITY', 'DAILY']).optional(),
    remuneration: z
      .object({
        kind: z.enum([
          'PREFIXED',
          'IPCA_PLUS',
          'CDI_PERCENTAGE',
          'SELIC_PERCENTAGE',
        ]),
        rate: z.string().min(1),
      })
      .optional(),
    isDeleted: z.boolean().optional(),
  }),
});

const curveContentPayload = z.object({
  eventId: z.uuid(),
  aggregateId: z.uuid(),
  revision: z.number().int().min(1),
  valuesRevision: z.number().int().min(1),
  curve: z.object({
    index: z.enum(EEconomicIndex).optional(),
    intervals: z
      .array(
        z.object({
          startDate: isoDate,
          endDate: isoDate,
          value: z.string().min(1),
        }),
      )
      .optional(),
    isDeleted: z.boolean().optional(),
  }),
});

// V2 and V3 on the recalculation queue, bound under the production
// consumer's token: applies each offer or curve event to the simulations'
// copy and, in the same unit of work, requests the calculation of every
// simulation using it, unless the guard dropped the event or it is a
// creation, which no simulation can be using yet.
export class PremiseCopyRecalculationConsumer {
  private readonly logger = new Logger(PremiseCopyRecalculationConsumer.name);

  constructor(
    private readonly offerCopies: OfferCopyRepository,
    private readonly curveCopies: CurveCopyRepository,
    private readonly recalculateOfferSimulations: RecalculateOfferSimulationsUseCase,
    private readonly recalculateCurveSimulations: RecalculateCurveSimulationsUseCase,
  ) {}

  @OnEvent('OfferCreated')
  onOfferCreated(payload: Record<string, unknown>): Promise<void> {
    return this.applyOffer(payload, false);
  }

  @OnEvent('OfferTermsChanged')
  onOfferTermsChanged(payload: Record<string, unknown>): Promise<void> {
    return this.applyOffer(payload, true);
  }

  @OnEvent('OfferDeleted')
  onOfferDeleted(payload: Record<string, unknown>): Promise<void> {
    return this.applyOffer(payload, true);
  }

  @OnEvent('CurveCreated')
  onCurveCreated(payload: Record<string, unknown>): Promise<void> {
    return this.applyCurve(payload, false);
  }

  @OnEvent('CurveValuesChanged')
  onCurveValuesChanged(payload: Record<string, unknown>): Promise<void> {
    return this.applyCurve(payload, true);
  }

  @OnEvent('CurveDeleted')
  onCurveDeleted(payload: Record<string, unknown>): Promise<void> {
    return this.applyCurve(payload, true);
  }

  private async applyOffer(
    payload: Record<string, unknown>,
    isRecalculating: boolean,
  ): Promise<void> {
    const event = offerContentPayload.parse(payload);
    const isApplied = await this.offerCopies.apply({
      offerId: event.aggregateId,
      eventId: event.eventId,
      revision: event.revision,
      termsRevision: event.termsRevision,
      offer: event.offer,
    });
    this.logger.log(
      `${isApplied ? 'Applied' : 'Dropped, older than the copy,'} ${String(payload['eventType'])} offerId=${event.aggregateId} revision=${event.revision} fields=${Object.keys(event.offer).join(',')}`,
    );
    if (!isApplied || !isRecalculating) return;
    const result = await this.recalculateOfferSimulations.execute(
      RecalculateOfferSimulationsCommand.of(event.aggregateId),
    );
    if (result.isErr()) throw result.error;
    this.logger.log(
      `Requested ${result.value} calculation(s) for offerId=${event.aggregateId}`,
    );
  }

  private async applyCurve(
    payload: Record<string, unknown>,
    isRecalculating: boolean,
  ): Promise<void> {
    const event = curveContentPayload.parse(payload);
    const isApplied = await this.curveCopies.apply({
      curveId: event.aggregateId,
      eventId: event.eventId,
      revision: event.revision,
      valuesRevision: event.valuesRevision,
      curve: event.curve,
    });
    this.logger.log(
      `${isApplied ? 'Applied' : 'Dropped, older than the copy,'} ${String(payload['eventType'])} curveId=${event.aggregateId} revision=${event.revision} fields=${Object.keys(event.curve).join(',')}`,
    );
    if (!isApplied || !isRecalculating) return;
    const result = await this.recalculateCurveSimulations.execute(
      RecalculateCurveSimulationsCommand.of(event.aggregateId),
    );
    if (result.isErr()) throw result.error;
    this.logger.log(
      `Requested ${result.value} calculation(s) for curveId=${event.aggregateId}`,
    );
  }
}
