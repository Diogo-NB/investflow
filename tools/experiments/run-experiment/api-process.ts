import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type {
  EExperimentEventContent,
  ExperimentTarget,
} from '@investflow/shared-infrastructure';
import type { ExperimentSwitches } from './scenarios';

const API_ENTRY = resolve('dist/apps/api/main.js');
const READY_TIMEOUT_MS = 60_000;
const STOP_TIMEOUT_MS = 30_000;
// Longer than the listener's 20 s long poll: a receive still open when the
// API stops would take a message and hide it for the visibility timeout
// after the process is gone.
const AFTER_STOP_MS = 21_000;

// One API process, started with the batch's variant and the switches of a
// stage. It runs from the
// run's folder, which has no .env, so it gets exactly the runner's
// environment and every switch set explicitly, never one left in a file.
export class ApiProcess {
  private child: ChildProcess | null = null;
  private logFd: number | null = null;

  constructor(
    private readonly apiUrl: string,
    private readonly variant: EExperimentEventContent,
  ) {}

  async assertStopped(): Promise<void> {
    if (await this.isAnswering()) {
      throw new Error(
        `An API already answers at ${this.apiUrl}; stop it before running experiments`,
      );
    }
  }

  async start(
    switches: ExperimentSwitches,
    target: ExperimentTarget | null,
    workingDirectory: string,
    logPath: string,
  ): Promise<void> {
    if (this.child) throw new Error('The API is already running');
    await this.assertStopped();
    this.logFd = openSync(logPath, 'a');
    const child = spawn(process.execPath, [API_ENTRY], {
      cwd: workingDirectory,
      env: {
        ...process.env,
        ...apiVariables(this.variant, switches, target),
      },
      stdio: ['ignore', this.logFd, this.logFd],
    });
    this.child = child;

    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (!(await this.isAnswering())) {
      if (child.exitCode !== null) {
        this.release();
        throw new Error(
          `The API exited with ${child.exitCode}; see ${logPath}`,
        );
      }
      if (Date.now() > deadline) {
        await this.stop();
        throw new Error(`The API did not answer in time; see ${logPath}`);
      }
      await sleep(500);
    }
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const stopped = await Promise.race([
        exited.then(() => true),
        sleep(STOP_TIMEOUT_MS).then(() => false),
      ]);
      if (!stopped) {
        child.kill('SIGKILL');
        await exited;
      }
    }
    this.release();
    await sleep(AFTER_STOP_MS);
  }

  private release(): void {
    this.child = null;
    if (this.logFd !== null) closeSync(this.logFd);
    this.logFd = null;
  }

  // Any answer counts, since the root path needs authentication.
  private async isAnswering(): Promise<boolean> {
    try {
      await fetch(this.apiUrl, { signal: AbortSignal.timeout(2_000) });
      return true;
    } catch {
      return false;
    }
  }
}

function apiVariables(
  variant: EExperimentEventContent,
  switches: ExperimentSwitches,
  target: ExperimentTarget | null,
): Record<string, string> {
  return {
    // Traces every handled event (type, event and aggregate ids, receive
    // count), so api.log shows which delivery a fault hit.
    LOG_LEVEL: 'debug',
    EXPERIMENT_EVENT_CONTENT: variant,
    EXPERIMENT_MESSAGE_FAULT: switches.messageFault,
    EXPERIMENT_SKIP_DEDUPLICATION: String(switches.isDeduplicationSkipped),
    EXPERIMENT_SKIP_REVISION_GUARD: String(switches.isRevisionGuardSkipped),
    EXPERIMENT_LOGIC_ERROR: String(switches.hasLogicError),
    // Empty counts as unset, so a stage without a target clears the target
    // of the shell.
    EXPERIMENT_TARGET_AGGREGATE_ID: target?.aggregateId ?? '',
    EXPERIMENT_TARGET_EVENT_TYPE: target?.eventType ?? '',
    EXPERIMENT_TARGET_ORDINAL: String(target?.ordinal ?? 1),
  };
}
