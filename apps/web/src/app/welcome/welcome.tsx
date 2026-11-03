import { Outlet } from 'react-router';
import { useGivenName } from '../auth/auth-context';

// The bounded contexts render their part of the home below the greeting.
export function Welcome() {
  const givenName = useGivenName();
  return (
    <section aria-labelledby="welcome-title" className="grid gap-6">
      <title>Início | InvestFlow</title>
      <div className="flex items-center gap-4 text-sm text-muted">
        <span>Início</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <div className="max-w-2xl">
        <h1
          id="welcome-title"
          className="m-0 text-2xl/tight font-semibold tracking-tight text-fg sm:text-3xl/tight"
        >
          {givenName ? `Olá, ${givenName}.` : 'Olá.'}
        </h1>
        <p className="mt-2 mb-0 max-w-prose text-lg/relaxed text-muted">
          Simule, compare e acompanhe seus investimentos.
        </p>
      </div>
      <Outlet />
    </section>
  );
}
