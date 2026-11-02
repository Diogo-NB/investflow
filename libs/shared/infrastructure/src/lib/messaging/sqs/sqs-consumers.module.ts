import {
  DynamicModule,
  Inject,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Type,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { SQSClient } from '@aws-sdk/client-sqs';
import { z } from 'zod';
import { awsConfig, type AwsConfig } from '../../aws/aws.config';
import { environmentConfig } from '../../config/environment-config';
import { EventDispatcher } from '../consumers/event-dispatcher.service';
import { SqsEventListener } from './sqs-event-listener';

export interface SqsConsumerBinding {
  readonly consumer: Type<object>;
  readonly queueUrlConfigKey: string;
}

const SQS_CONSUMER_BINDINGS = Symbol('SQS_CONSUMER_BINDINGS');
const SQS_QUEUE_URLS = Symbol('SQS_QUEUE_URLS');

// Keyed by each binding's queueUrlConfigKey.
type SqsQueueUrls = Readonly<Record<string, string>>;

// The variables are the bindings' own keys, so the host's bindings decide
// what it requires.
function queueUrlsEnvironment(bindings: readonly SqsConsumerBinding[]) {
  return z.object(
    Object.fromEntries(
      bindings.map(({ queueUrlConfigKey }) => [queueUrlConfigKey, z.url()]),
    ),
  );
}

@Module({})
export class SqsConsumersModule
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly listeners: SqsEventListener[] = [];

  constructor(
    @Inject(SQS_CONSUMER_BINDINGS)
    private readonly bindings: SqsConsumerBinding[],
    @Inject(SQS_QUEUE_URLS) private readonly queueUrls: SqsQueueUrls,
    @Inject(awsConfig.KEY) private readonly aws: AwsConfig,
    private readonly moduleRef: ModuleRef,
    private readonly dispatcher: EventDispatcher,
  ) {}

  static register(bindings: SqsConsumerBinding[]): DynamicModule {
    const queueUrlsConfig = environmentConfig(
      'sqsQueues',
      queueUrlsEnvironment(bindings),
      (environment): SqsQueueUrls => environment,
    );
    return {
      module: SqsConsumersModule,
      imports: [
        ConfigModule.forFeature(awsConfig),
        ConfigModule.forFeature(queueUrlsConfig),
      ],
      providers: [
        { provide: SQS_CONSUMER_BINDINGS, useValue: bindings },
        { provide: SQS_QUEUE_URLS, useExisting: queueUrlsConfig.KEY },
        EventDispatcher,
      ],
    };
  }

  onApplicationBootstrap(): void {
    if (this.bindings.length === 0) return;

    const sqsClient = new SQSClient({ region: this.aws.region });
    for (const { consumer, queueUrlConfigKey } of this.bindings) {
      const listener = new SqsEventListener(
        sqsClient,
        this.queueUrls[queueUrlConfigKey],
        // Consumers are provided by the module that owns their dependencies.
        this.moduleRef.get(consumer, { strict: false }),
        this.dispatcher,
      );
      listener.start();
      this.listeners.push(listener);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.listeners.map((listener) => listener.stop()));
  }
}
