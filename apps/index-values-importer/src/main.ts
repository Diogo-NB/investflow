import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { EPublishedIndex } from '@investflow/market-data-domain';
import { PublishedIndexValuesImportJob } from '@investflow/market-data-infrastructure';
import { CalendarDate } from '@investflow/shared-domain';
import { ImporterModule } from './app/importer.module';

const INDEX_OPTION = '--index=';
const START_DATE_OPTION = '--start-date=';
const USAGE = `Usage: node main.js --index=CDI|SELIC|SELIC_TARGET [--start-date=YYYY-MM-DD]

Imports the values the Banco Central published for one index, through today.
--start-date sets the first date to import. Without it, the import starts the
day after the last stored value, and fails if the index has none. A date
already stored fails the import.`;

interface ImporterOptions {
  readonly index: EPublishedIndex;
  readonly startDate: CalendarDate | null;
}

function parseOptions(args: readonly string[]): ImporterOptions {
  const valueOf = (option: string) =>
    args.find((arg) => arg.startsWith(option))?.slice(option.length);
  const unknown = args.filter(
    (arg) =>
      !arg.startsWith(INDEX_OPTION) && !arg.startsWith(START_DATE_OPTION),
  );
  if (unknown.length > 0) throw new Error(`${unknown.join(' ')}\n\n${USAGE}`);

  const index = Object.values(EPublishedIndex).find(
    (known) => known === valueOf(INDEX_OPTION),
  );
  if (!index) throw new Error(`Invalid or missing --index\n\n${USAGE}`);

  const startDate = valueOf(START_DATE_OPTION);
  if (startDate === undefined) return { index, startDate: null };
  const parsed = CalendarDate.create(startDate);
  if (parsed.isErr()) {
    throw new Error(`Invalid --start-date: ${startDate}\n\n${USAGE}`);
  }
  return { index, startDate: parsed.value };
}

async function main(): Promise<void> {
  const { index, startDate } = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(ImporterModule, {
    logger: ['error', 'warn'],
  });
  try {
    await app.get(PublishedIndexValuesImportJob).importIndex(index, startDate);
    console.log(`${index}: imported`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Importing the index values failed:', error);
  process.exitCode = 1;
});
