import { Link, useParams, useSearchParams } from 'react-router';
import { PageLabel } from '../../ui/page-label';
import { secondaryButton } from '../../ui/styles';
import { SimulationEditor } from './simulation-editor';
import {
  TEMPLATE_PARAM,
  useSimulationWorkspace,
} from './use-simulation-workspace';

export function SimulationWorkspacePage() {
  const { simulationId } = useParams();
  const [searchParams] = useSearchParams();
  const workspace = useSimulationWorkspace(simulationId);
  const { setup } = workspace;

  if (setup.status === 'ready') {
    return (
      <SimulationEditor
        // A new editor for each simulation and each saved revision, so the
        // form starts from the values saved, including ones saved elsewhere.
        key={
          setup.workspace
            ? `${setup.workspace.simulation.id}:${setup.workspace.simulation.revision}`
            : `new:${searchParams.get(TEMPLATE_PARAM) ?? ''}`
        }
        saved={setup.workspace}
        initialValues={setup.initialValues}
        options={setup.options}
        workspace={workspace}
      />
    );
  }

  return (
    <section aria-labelledby="simulation-title" className="grid gap-6">
      <title>Simulação | InvestFlow</title>
      <PageLabel>
        <Link to="/simulacoes" className="text-accent">
          Simulações
        </Link>
      </PageLabel>
      {setup.status === 'loading' && (
        <p role="status" className="m-0 text-muted">
          <span id="simulation-title">Carregando simulação…</span>
        </p>
      )}
      {setup.status === 'missing' && (
        <div className="grid justify-items-start gap-4">
          <h1 id="simulation-title" className="m-0 text-xl font-semibold">
            Simulação não encontrada
          </h1>
          <p className="m-0 text-muted">
            Ela pode ter sido excluída. Suas outras simulações continuam na
            lista.
          </p>
          <Link to="/simulacoes" className={secondaryButton}>
            Ver simulações
          </Link>
        </div>
      )}
      {setup.status === 'error' && (
        <div role="alert" className="grid justify-items-start gap-4">
          <h1 id="simulation-title" className="m-0 text-xl font-semibold">
            Não foi possível abrir a simulação
          </h1>
          <button
            type="button"
            className={secondaryButton}
            onClick={workspace.retrySetup}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </section>
  );
}
