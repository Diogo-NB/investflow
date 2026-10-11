import {
  DynamicModule,
  Inject,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Type,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { SQSClient } from '@aws-sdk/client-sqs';
import { EventDispatcher } from '../consumers/event-dispatcher.service';
import { SqsEventListener } from './sqs-event-listener';

export interface SqsConsumerBinding {
  readonly consumer: Type<object>;
  readonly queueUrlConfigKey: string;
}

const SQS_CONSUMER_BINDINGS = Symbol('SQS_CONSUMER_BINDINGS');

@Module({})
export class SqsConsumersModule
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly listeners: SqsEventListener[] = [];

  constructor(
    @Inject(SQS_CONSUMER_BINDINGS)
    private readonly bindings: SqsConsumerBinding[],
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly dispatcher: EventDispatcher,
  ) {}

  static register(bindings: SqsConsumerBinding[]): DynamicModule {
    return {
      module: SqsConsumersModule,
      providers: [
        { provide: SQS_CONSUMER_BINDINGS, useValue: bindings },
        EventDispatcher,
      ],
    };
  }

  onApplicationBootstrap(): void {
    if (this.bindings.length === 0) return;

    const sqsClient = new SQSClient({
      region: this.config.getOrThrow<string>('AWS_REGION'),
    });
    for (const { consumer, queueUrlConfigKey } of this.bindings) {
      const listener = new SqsEventListener(
        sqsClient,
        this.config.getOrThrow<string>(queueUrlConfigKey),
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
