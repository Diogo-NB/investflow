import { investmentSimulatorSections } from '@investflow/investment-simulator-web';
import { Link } from 'react-router';

const card =
  'group flex items-start gap-4 rounded-surface border border-border bg-surface p-6 text-fg no-underline transition-colors duration-200 hover:border-accent motion-safe:animate-fade-in motion-safe:[animation-fill-mode:backwards]';

// Kept local: the app does not import the context's internal icon set.
function ArrowRight() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
    >
      <path d="M4 10h12m-4.5-4.5L16 10l-4.5 4.5" />
    </svg>
  );
}

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

      <div className="mt-10 grid gap-4 sm:mt-14 lg:grid-cols-2">
        {investmentSimulatorSections.map(
          ({ path, label, description, action, Icon }, index) => (
            <Link
              key={path}
              to={path}
              className={card}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-surface bg-accent-soft text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-fg"
              >
                <Icon className="size-6 shrink-0" />
              </span>
              <span className="grid flex-1 gap-1">
                <span className="text-lg font-semibold">{label}</span>
                <span className="text-muted">{description}</span>
                <span className="mt-2 inline-flex items-center gap-1 font-medium text-accent group-hover:underline">
                  {action}
                  <ArrowRight />
                </span>
              </span>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
