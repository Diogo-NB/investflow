---
name: investflow-fault-experiments
description: Run, verify, and report InvestFlow's fault injection experiments (`pnpm experiment:run`), which inject message faults, turn protections off, or plant a logic error, then judge every simulation against a full recalculation. Use when asked to run an experiment, a scenario, or a smoke test of the runner; to read or compare its CSV and JSON output; to explain why a run did not settle; to give the user the homolog command; or to change the runner under `tools/experiments/` or the fault implementations under `libs/*/infrastructure/src/lib/experiments/`. Do not use for the outbox benchmark or for ordinary local testing of a feature.
---

# InvestFlow Fault Experiments

The design (variants, faults F1–F6, protections, repairs R1/R2/E1, the
oracle's categories, and the expected outcomes each run is checked against)
is in `docs/implementation/planned/fault-injection-experiments.md`. This
skill covers running the runner and reading its output; it never decides a
hypothesis. Name every code with its meaning when reporting (F1 is "the
first change of the offer's terms dead-lettered").

## Where it runs

- **Local (Floci):** you run it. Docker must be up (`pnpm db:up`); if it is
  not, ask the user to start it. The local database is disposable;
  `pnpm db:setup` resets it when runs have piled up data.
- **Homolog (real AWS):** only the user runs it. Never run it, any `aws`
  command, or anything that resolves credentials, and never read
  `.env.homolog`. Give the user the command:

  ```bash
  AWS_PROFILE=investflow-homolog pnpm experiment:run --env-file .env.homolog --scenarios <list>
  ```

  Then read the output folder they point you to.

## Before running

1. Load Node: `source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use`.
2. No API may be running: the runner starts and stops its own, with the
   switches of each stage, and refuses to start when port 3000 answers
   (`ss -ltnp | grep ':3000\b'`). Ask before stopping one you did not start.
3. Locally, drop a shell `AWS_PROFILE` (`env -u AWS_PROFILE`), since `.env`
   holds Floci's key pair.
4. `.env` needs `EXPERIMENT_KEYCLOAK_PASSWORD`,
   `EXPERIMENT_KEYCLOAK_CLIENT_SECRET`, and every queue and dead-letter queue
   URL of `.env.example`; a missing one fails at startup naming it.

`pnpm experiment:run` builds the API, then runs the tool; `--help` lists
the options and scenarios. Defaults: every scenario, 3 runs, 1,000
simulations, 60 s of quiet before a stage counts as settled.

## Running

- **Smoke test** after changing the runner or a fault (about 5 minutes):
  `env -u AWS_PROFILE pnpm -s experiment:run --scenarios baseline,f1-dead-letter --runs 1 --simulations 50 --quiet-s 20`.
- **A batch** takes hours: each stage waits for its quiet period, and a
  dead-lettered message needs 5 receives 30 s apart (about 2.5 minutes).
  Start it with the Bash tool's `run_in_background`, redirect the output to
  a file in the scratchpad, and wait for the completion notification
  instead of polling.
- Each run creates its own curve, offers, and simulations through the API
  as `investflow-dev`; run k of every scenario uses the same seed, so
  scenarios compare on equal data.

## Output

Under `tmp/experiments/` (`--out`), per batch `<batch>`:

- `<batch>-report.json`: the options, one entry per stage, and `problems`.
  Read it first. It is rewritten after each run.
- `<batch>-summary.csv`: the same stages as a table.
- `<batch>-<scenario>-run<k>/`: `simulations.csv` (one verdict per
  simulation and stage, with `divergent_fields` and fingerprints),
  `timeline.csv` (the target offer's verdicts, pending simulations,
  unpublished events, and queue counts every 5 s), and `api.log` (every
  handled event at debug level, plus each fault's warning).

Stages: `setup` (population calculated with no switch on), `faulted`
(after the target offer's two term changes with the scenario's switches),
and `restored` (F2b and F5 only: API restarted with other switches, F2b
after redriving the dead-letter queues).

Verdicts, in the order the oracle applies them: `correct`; `wrong-alarmed`
(FAILED, or a message of the simulation, offer, or curve in any
dead-letter queue); `wrong-visible` (not settled: pending, invalid, or
older than its premises); `wrong-silent`.

## Verifying a batch

1. The exit code is 1 and `problems` is non-empty when a stage did not
   settle, a setup had a wrong result, or `baseline` had one in any stage:
   those verdicts are unusable, a defect of the runner, the oracle, or the
   system rather than a finding. Find the cause before reporting numbers.
2. A setup stage's `moved_messages` counts leftovers drained from the
   dead-letter queues of an earlier run, not something the stage did.
3. Each fault hit its target: in `api.log`, the target offer's
   `OfferTermsChanged` shows the expected trace (five `Failed handling ...
   receive=1..5` for a dead letter; the fault class's warning for a
   duplicate or a rejection). A fault that never fired makes the scenario
   look like the baseline.
4. Compare each scenario's `faulted` and `restored` verdicts with the
   expected outcomes table in the plan doc. A difference is a finding: say
   which row and why, from the timeline and the log.
5. A stage that timed out: look at the last `timeline.csv` rows (which
   count never reached 0) and the end of `api.log`.

## Reporting

One table per batch: scenario, stage, and the mean and range of each
verdict count over the runs, with the time to settle. Then one sentence
per scenario against its expected outcome, the problems, what was not run,
and the paths of the report and run folders. Never call a hypothesis
confirmed from a batch with problems.

## Changing the runner or a fault

- The runner follows the `tools/` conventions in `AGENTS.md`: entry
  `tools/experiments/run-experiment.ts`, modules in
  `tools/experiments/run-experiment/`, checked by `tools:typecheck`.
  Scenarios are data in `scenarios.ts`; a new one is an entry there.
- A fault, a disabled protection, or a logic error is an alternative
  implementation (decorator, strategy, or subclass) under `experiments/`,
  bound in its context's experiment bindings file from `experimentsConfig`.
  Production classes never read the switches and get at most a protected
  method to override; never a new port for a switch.
- The oracle reads through `SimulationReferenceModule`, the production
  implementations, so the reference never carries the fault under test.
- Validate with `pnpm nx run tools:typecheck`, the lint and tests of the
  touched projects, and the smoke test above.
