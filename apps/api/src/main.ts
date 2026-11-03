import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createRequestValidationPipe } from '@investflow/shared-infrastructure';
import { AppModule } from './app/app.module';
import { ServerConfig, serverConfig } from './app/server.config';

async function bootstrap() {
  // Startup logs wait for the configured levels, then replay through them.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const { port, logLevels } = app.get<ServerConfig>(serverConfig.KEY);
  app.useLogger(logLevels);
  app.enableShutdownHooks();
  app.useGlobalPipes(createRequestValidationPipe());
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
