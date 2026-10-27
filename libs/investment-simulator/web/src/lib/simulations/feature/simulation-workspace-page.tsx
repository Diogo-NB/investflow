import { useParams } from 'react-router';
import { SavedSimulationEditor } from './simulation-editor';
import { SimulationPageFallback } from './simulation-page-fallback';
import { useSimulationWorkspace } from './use-simulation-workspace';

export function SimulationWorkspacePage() {
  const { simulationId = '' } = useParams();
  const { setup, retrySetup, edit, recalculate, remove } =
    useSimulationWorkspace(simulationId);

  if (setup.status !== 'ready') {
    return (
      <SimulationPageFallback status={setup.status} onRetry={retrySetup} />
    );
  }
  return (
    <SavedSimulationEditor
      // A new editor for each simulation and each reload. Not per revision:
      // polling must never discard unsaved edits.
      key={`${setup.workspace.simulation.id}:${setup.loadGeneration}`}
      workspace={setup.workspace}
      initialValues={setup.initialValues}
      options={setup.options}
      controls={{ edit, recalculate, remove }}
    />
  );
}
