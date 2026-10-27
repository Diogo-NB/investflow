import { Link, useSearchParams } from 'react-router';
import { SimulationIcon } from '../../ui/icons';
import { PageLabel } from '../../ui/page-label';
import { secondaryButton } from '../../ui/styles';
import { listSearch } from '../utils/simulation-list-search';

interface SimulationPageFallbackProps {
  readonly status: 'loading' | 'missing' | 'error';
  readonly onRetry: () => void;
}

// What a simulation page shows until its editor can open.
export function SimulationPageFallback({
  status,
  onRetry,
}: SimulationPageFallbackProps) {
  const [searchParams] = useSearchParams();
  const listPath = `/simulacoes${listSearch(searchParams)}`;

  return (
    <section aria-labelledby="simulation-title" className="grid gap-6">
      <title>Simulação | InvestFlow</title>
      <PageLabel icon={SimulationIcon}>
        <Link to={listPath} className="text-accent">
          Simulações
        </Link>
      </PageLabel>
      {status === 'loading' && (
        <p role="status" className="m-0 text-muted">
          <span id="simulation-title">Carregando simulação…</span>
        </p>
      )}
      {status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="simulation-title" className="m-0 text-xl font-semibold">
            Simulação não encontrada
          </h1>
          <p className="m-0 text-muted">
            Ela pode ter sido excluída. Suas outras simulações continuam na
            lista.
          </p>
          <Link to={listPath} className={secondaryButton}>
            Ver simulações
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="simulation-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir a simulação
          </h1>
          <button type="button" className={secondaryButton} onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      )}
    </section>
  );
}
