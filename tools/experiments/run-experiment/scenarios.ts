import { EExperimentMessageFault } from '@investflow/shared-infrastructure';

export interface ExperimentSwitches {
  readonly messageFault: EExperimentMessageFault;
  readonly isDeduplicationSkipped: boolean;
  readonly isRevisionGuardSkipped: boolean;
  readonly hasLogicError: boolean;
}

// The API that follows the faulted stage: started with other switches and,
// when asked, after the dead-lettered messages are sent back to their queues.
export interface RestoredStage {
  readonly switches: ExperimentSwitches;
  readonly isDeadLetterRedriven: boolean;
}

export interface Scenario {
  readonly name: string;
  readonly faulted: ExperimentSwitches;
  readonly restored: RestoredStage | null;
}

const noSwitches: ExperimentSwitches = {
  messageFault: EExperimentMessageFault.NONE,
  isDeduplicationSkipped: false,
  isRevisionGuardSkipped: false,
  hasLogicError: false,
};

const unguarded: Partial<ExperimentSwitches> = { isRevisionGuardSkipped: true };

function switches(
  ...overrides: Partial<ExperimentSwitches>[]
): ExperimentSwitches {
  return Object.assign({}, noSwitches, ...overrides);
}

// F2b redrives with the protections of its faulted stage still off, so the
// redriven message meets the same consumer the fault did.
function deadLetterThenRedrive(
  name: string,
  protections: Partial<ExperimentSwitches> = {},
): Scenario {
  return {
    name,
    faulted: switches(protections, {
      messageFault: EExperimentMessageFault.DEAD_LETTER,
    }),
    restored: { switches: switches(protections), isDeadLetterRedriven: true },
  };
}

export const scenarios: readonly Scenario[] = [
  { name: 'baseline', faulted: noSwitches, restored: null },
  {
    name: 'f1-dead-letter',
    faulted: switches({ messageFault: EExperimentMessageFault.DEAD_LETTER }),
    restored: null,
  },
  {
    name: 'f2a-reject-until-newer',
    faulted: switches({
      messageFault: EExperimentMessageFault.REJECT_UNTIL_NEWER,
    }),
    restored: null,
  },
  {
    name: 'f2a-reject-until-newer-unguarded',
    faulted: switches(unguarded, {
      messageFault: EExperimentMessageFault.REJECT_UNTIL_NEWER,
    }),
    restored: null,
  },
  deadLetterThenRedrive('f2b-dead-letter-redrive'),
  deadLetterThenRedrive('f2b-dead-letter-redrive-unguarded', unguarded),
  {
    name: 'f3-duplicate',
    faulted: switches({ messageFault: EExperimentMessageFault.DUPLICATE }),
    restored: null,
  },
  {
    name: 'f3-duplicate-undeduplicated',
    faulted: switches({
      messageFault: EExperimentMessageFault.DUPLICATE,
      isDeduplicationSkipped: true,
    }),
    restored: null,
  },
  {
    name: 'f3-duplicate-undeduplicated-unguarded',
    faulted: switches(unguarded, {
      messageFault: EExperimentMessageFault.DUPLICATE,
      isDeduplicationSkipped: true,
    }),
    restored: null,
  },
  // Restoring the calculation recalculates nothing by itself: the stored
  // results keep their fingerprints, so the restored stage shows whether
  // anything reveals the wrong results without a repair.
  {
    name: 'f5-logic-error',
    faulted: switches({ hasLogicError: true }),
    restored: { switches: noSwitches, isDeadLetterRedriven: false },
  },
];

export const scenarioNames = scenarios.map(({ name }) => name);

export const setupSwitches = noSwitches;
