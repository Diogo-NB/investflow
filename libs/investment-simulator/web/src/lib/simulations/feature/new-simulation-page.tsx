import { NewSimulationEditor } from './simulation-editor';
import { SimulationPageFallback } from './simulation-page-fallback';
import { useSimulationCreation } from './use-simulation-creation';

export function NewSimulationPage() {
  const { setup, retrySetup, create } = useSimulationCreation();

  if (setup.status !== 'ready') {
    return (
      <SimulationPageFallback status={setup.status} onRetry={retrySetup} />
    );
  }
  return (
    <NewSimulationEditor
      // A fresh form for each template.
      key={setup.templateId ?? ''}
      initialValues={setup.initialValues}
      options={setup.options}
      create={create}
    />
  );
}
