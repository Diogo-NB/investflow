/** Fallback for unexpected render failures; it never shows the underlying error. */
export function RouteError() {
  return (
    <section
      role="alert"
      aria-labelledby="route-error-title"
      className="pt-6 sm:pt-10"
    >
      <title>Erro | InvestFlow</title>
      <h1
        id="route-error-title"
        className="m-0 text-2xl leading-tight font-semibold text-fg"
      >
        Algo deu errado.
      </h1>
      <p className="mt-4 mb-6 text-muted">
        Recarregue a página para tentar novamente.
      </p>
      <button
        type="button"
        className="min-h-11 cursor-pointer rounded-control bg-accent px-5 py-3 text-base font-medium text-accent-fg hover:bg-fg"
        onClick={() => window.location.reload()}
      >
        Recarregar
      </button>
    </section>
  );
}
