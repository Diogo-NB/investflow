import { ConfigObject, registerAs } from '@nestjs/config';
import { z } from 'zod';

// Registered with ConfigModule.forFeature, so Nest parses it while the host
// starts and a bad variable stops startup. Issues name the variable but never
// echo its value, which may be a secret.
export function environmentConfig<
  TEnvironment extends z.ZodType,
  TConfig extends ConfigObject,
>(
  namespace: string,
  schema: TEnvironment,
  toConfig: (environment: z.output<TEnvironment>) => TConfig,
) {
  return registerAs(namespace, (): TConfig => {
    // Compose's ${NAME:-} and a bare NAME= in .env pass empty strings, which
    // would defeat the schema's defaults and turn into 0 when coerced.
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => value !== ''),
    );
    const parsed = schema.safeParse(environment);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
      );
      throw new Error(
        `Invalid ${namespace} environment:\n${issues.join('\n')}`,
      );
    }
    return toConfig(parsed.data);
  });
}
