export class ApiError extends Error {
  constructor(
    readonly status: number,
    // Stable application error code; null for transport or framework errors.
    readonly code: string | null,
    // The API's pt-BR explanation, safe to show; null when the body has none.
    readonly userMessage: string | null,
    readonly details: Readonly<Record<string, unknown>>,
  ) {
    super(
      `API request failed with status ${status}${code ? ` (${code})` : ''}`,
    );
    this.name = 'ApiError';
  }

  static async from(response: Response): Promise<ApiError> {
    const body: unknown = await response.json().catch(() => null);
    const record =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const code = typeof record['code'] === 'string' ? record['code'] : null;
    const message =
      typeof record['message'] === 'string' && record['message']
        ? record['message']
        : null;
    const details =
      typeof record['details'] === 'object' && record['details'] !== null
        ? (record['details'] as Record<string, unknown>)
        : {};
    return new ApiError(response.status, code, message, details);
  }
}
