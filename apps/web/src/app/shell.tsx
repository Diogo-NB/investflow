import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { investmentSimulatorSections } from '@investflow/investment-simulator-web';
import { useIdentity, useLogout } from './auth/auth-context';

const navLink =
  'group flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 whitespace-nowrap font-medium text-muted no-underline transition-colors duration-200 hover:bg-accent-soft hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent';

export function Shell() {
  const identity = useIdentity();
  const { status: logoutStatus, logout } = useLogout();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Move focus to the new page so screen readers and keyboard users start there after navigation.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        className="absolute top-3 left-4 z-10 -translate-y-24 rounded-control bg-accent px-4 py-3 text-accent-fg focus:translate-y-0"
        href="#main-content"
      >
        Ir para o conteúdo
      </a>

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 sm:px-10">
          <Link
            to="/"
            aria-label="InvestFlow, página inicial"
            className="flex min-h-11 items-center gap-3 rounded-control text-lg font-semibold tracking-tight text-fg no-underline"
          >
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-control bg-accent text-sm tracking-normal text-accent-fg"
            >
              if
            </span>
            InvestFlow
          </Link>

          {/* On phones the sections get their own row, scrolling rather than
              wrapping one of them onto a line of its own. */}
          <nav
            aria-label="Principal"
            className="order-last -mx-3 flex w-[calc(100%+1.5rem)] overflow-x-auto sm:order-0 sm:mx-0 sm:mr-auto sm:w-auto"
          >
            {investmentSimulatorSections.map(({ path, label, Icon }) => (
              <NavLink key={path} to={path} className={navLink}>
                <Icon className="size-5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <p className="m-0 grid min-w-0 text-right text-sm">
              <span className="text-muted">Sua conta</span>
              <strong className="max-w-40 truncate font-medium text-fg sm:max-w-64">
                {identity}
              </strong>
            </p>
            <button
              type="button"
              className="min-h-11 min-w-20 cursor-pointer rounded-control px-3 font-medium text-accent hover:bg-accent-soft disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent"
              disabled={logoutStatus === 'pending'}
              aria-describedby={
                logoutStatus === 'error' ? 'logout-error' : undefined
              }
              onClick={logout}
            >
              {logoutStatus === 'pending' ? 'Saindo…' : 'Sair'}
            </button>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-6 outline-none sm:px-10 sm:py-10"
      >
        {logoutStatus === 'error' && (
          <p
            id="logout-error"
            role="alert"
            className="m-0 mb-8 text-sm text-error"
          >
            Não foi possível sair. Tente novamente.
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
