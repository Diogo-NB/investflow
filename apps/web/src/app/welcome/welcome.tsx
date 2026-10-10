import { Link } from 'react-router';

export function Welcome() {
  return (
    <section aria-labelledby="welcome-title" className="pt-6 sm:pt-10">
      <title>Início | InvestFlow</title>
      <div className="flex items-center gap-4 text-sm text-muted">
        <span>Início</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      <div className="mt-10 max-w-2xl sm:mt-14">
        <h1
          id="welcome-title"
          className="m-0 text-2xl leading-tight font-semibold tracking-tight text-fg sm:text-3xl"
        >
          Bem-vindo ao InvestFlow.
        </h1>
        <p className="mt-4 mb-0 max-w-prose text-lg leading-relaxed text-muted">
          Um espaço para suas próximas decisões de investimento.
        </p>
      </div>

      <Link
        to="/simulacoes"
        className="group mt-10 flex flex-wrap items-center justify-between gap-4 rounded-surface border border-border bg-surface p-6 text-fg no-underline hover:border-accent sm:mt-14"
      >
        <span className="grid gap-1">
          <span className="text-lg font-semibold">Simulações de CDB</span>
          <span className="text-muted">
            Calcule o resultado líquido no vencimento e compare cenários.
          </span>
        </span>
        <span className="font-medium text-accent group-hover:underline">
          Abrir simulações →
        </span>
      </Link>
    </section>
  );
}
