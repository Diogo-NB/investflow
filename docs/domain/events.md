# Event Catalog

## Envelope Standard

All events share this structure:

```json
{
  "eventId": "UUID",
  "eventType": "string",
  "timestamp": "ISO-8601",
  "correlationId": "UUID",
  "actorId": "UUID",
  "payload": {}
}
```

`correlationId` — traces a full flow (e.g. the original HTTP request ID).
`actorId` — the user who triggered the action (investorId or orgUserId).

---

## Event Catalog

| Event | Published When | Payload Fields | Consumer |
|---|---|---|---|
| `ProductPublishedEvent` | ORG_USER publishes a product | `productId`, `organizationId`, `type`, `rate`, `totalVolume` | — (future notification) |
| `ProductClosedEvent` | Product is closed | `productId`, `reason` | — |
| `OrderCreatedEvent` | Investor creates an order | `orderId`, `productId`, `investorId`, `organizationId`, `amount` | Order Analyzer Consumer |
| `OrderAnalysisStartedEvent` | Consumer begins risk analysis | `orderId` | — (internal audit) |
| `OrderApprovedEvent` | Risk analysis approves order | `orderId`, `productId`, `investorId`, `amount` | Application Creator |
| `OrderRejectedEvent` | Risk analysis rejects order | `orderId`, `reason` | — |
| `OrderExpiredEvent` | Order timeout reached | `orderId`, `releasedVolume` | — |
| `ApplicationCreatedEvent` | Order approved → Application created | `applicationId`, `orderId`, `investorId`, `organizationId`, `type`, `appliedAmount`, `rate`, `startDate`, `endDate` | Portfolio Projection Consumer |
| `ApplicationValueUpdatedEvent` | Application value recalculated | `applicationId`, `previousValue`, `newValue`, `calculatedAt` | Portfolio Projection Consumer |
| `ApplicationMaturedEvent` | Application `endDate` reached | `applicationId`, `finalValue`, `maturedAt` | Portfolio Projection Consumer |
| `ApplicationRedeemedEvent` | Investor redeems application | `applicationId`, `redeemedAt` | Portfolio Projection Consumer |

