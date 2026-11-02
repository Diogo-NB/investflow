import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createRequestValidationPipe } from '@investflow/shared-infrastructure';
import { AppModule } from './app/app.module';
import { ServerConfig, serverConfig } from './app/server.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(createRequestValidationPipe());
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const { port } = app.get<ServerConfig>(serverConfig.KEY);
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
