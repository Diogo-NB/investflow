export class RecalculateOfferSimulationsCommand {
  private constructor(readonly offerId: string) {}

  static of(offerId: string): RecalculateOfferSimulationsCommand {
    return new RecalculateOfferSimulationsCommand(offerId);
  }
}
