# Errors And Results

## Error Contract

- Expected business and application failures use `AppError` or subclasses.
- `AppError` carries:
  - stable `code`;
  - human-readable `message`;
  - `kind` for transport mapping;
  - optional `metadata`;
  - optional `cause`.
- Domain-specific failures extend `DomainError`.
- Keep error codes stable. Do not derive client behavior from error messages.

## Result Usage

- Use `Result<T, E extends AppError>` for meaningful expected failures from:
  - external input;
  - use cases and query handlers;
  - domain services;
  - application services;
  - repository operations with meaningful failure semantics;
  - external integrations.
- Do not force `Result` onto trivial pure methods.
- Command-side repository ports return `Result` for lookups and persistence.
  A missing aggregate is represented as an error, usually a context-specific
  not-found error.
- Read/query models may still use nullable values when absence is just data and
  has no business failure semantics.
- Controllers unwrap `Result` at the transport boundary and never return raw
  `Result` objects.

## HTTP Mapping

- Transport filters map `AppError.kind` to HTTP status codes.
- Error responses use this envelope:

```json
{
  "statusCode": 422,
  "code": "SOME_STABLE_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

- Successful responses return presenter DTOs directly, without a generic
  success envelope.
