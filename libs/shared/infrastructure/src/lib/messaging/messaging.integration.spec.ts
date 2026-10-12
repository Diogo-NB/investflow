import { Injectable, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import {
  DeleteRuleCommand,
  EventBridgeClient,
  PutRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} from '@aws-sdk/client-eventbridge';
import {
  AggregateRoot,
  DomainEvent,
  DomainEventRecorder,
  generateUuid,
  UtcInstant,
} from '@investflow/shared-domain';
import { ClockModule } from '../clocks/clock.module';
import { BaseRepository } from '../persistence/base.repository';
import { PrismaModule } from '../persistence/prisma/prisma.module';
import { PrismaService } from '../persistence/prisma/prisma.service';
import { UnitOfWork } from '../persistence/unit-of-work';
import { EventDispatcher } from './consumers/event-dispatcher.service';
import { OnEvent } from './consumers/on-event.decorator';
import { MessageBroker } from './outbox/message-broker.port';
import { OutboxModule } from './outbox/outbox.module';
import { OutboxPollerService } from './outbox/outbox-poller.service';
import { SqsConsumersModule } from './sqs/sqs-consumers.module';

jest.mock('jwks-rsa', () => ({ passportJwtSecret: jest.fn() }));

// Run against an isolated database with the migrations already applied and
// the local Floci container running (`pnpm db:up`). Jest needs
// NODE_OPTIONS=--experimental-vm-modules because the AWS SDK HTTP handler
// imports `node:http` dynamically.
const connectionString = process.env['MESSAGING_TEST_DATABASE_URL'];
const integration = connectionString ? describe : describe.skip;

const region = process.env['AWS_REGION'] ?? 'us-east-1';
const eventBusName = process.env['EVENT_BUS_NAME'] ?? 'investflow';
const runId = generateUuid().slice(0, 8);
const context = `test-${runId}`;
const queueName = `messaging-test-${runId}`;
const queueUrlConfigKey = 'MESSAGING_TEST_QUEUE_URL';

class TestAggregate extends AggregateRoot {
  static happen(): TestAggregate {
    const aggregate = new TestAggregate(generateUuid());
    const event: DomainEvent = {
      eventId: generateUuid(),
      occurredAt: UtcInstant.ofIso('2026-10-11T12:00:00Z'),
      eventType: 'TestHappened',
      version: 1,
      aggregateId: aggregate.id,
      aggregateType: 'TestAggregate',
      context,
    };
    return aggregate.apply(event);
  }
}

class TestRepository extends BaseRepository<TestAggregate> {
  protected async persistAggregate(): Promise<void> {
    return;
  }
}

@Injectable()
class TestConsumer {
  readonly handledEventIds: string[] = [];

  @OnEvent('TestHappened')
  async onTestHappened(payload: Record<string, unknown>): Promise<void> {
    this.handledEventIds.push(String(payload['eventId']));
  }
}

async function eventually(assertion: () => Promise<void> | void) {
  const deadline = Date.now() + 15_000;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

integration('Messaging through EventBridge and SQS', () => {
  const sqs = new SQSClient({ region });
  const eventBridge = new EventBridgeClient({ region });
  let queueUrl: string;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const queue = await sqs.send(
      new CreateQueueCommand({ QueueName: queueName }),
    );
    queueUrl = queue.QueueUrl ?? '';
    const attributes = await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['QueueArn'],
      }),
    );
    await eventBridge.send(
      new PutRuleCommand({
        Name: queueName,
        EventBusName: eventBusName,
        EventPattern: JSON.stringify({ source: [`investflow.${context}`] }),
      }),
    );
    await eventBridge.send(
      new PutTargetsCommand({
        Rule: queueName,
        EventBusName: eventBusName,
        Targets: [{ Id: queueName, Arn: attributes.Attributes?.['QueueArn'] }],
      }),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: connectionString,
              AWS_REGION: region,
              EVENT_BUS_NAME: eventBusName,
              [queueUrlConfigKey]: queueUrl,
            }),
          ],
        }),
        PrismaModule,
        ClockModule,
        OutboxModule,
        SqsConsumersModule.register([
          { consumer: TestConsumer, queueUrlConfigKey },
        ]),
      ],
      providers: [TestConsumer],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    try {
      await prisma?.client.outboxEvent.deleteMany({ where: { context } });
      await prisma?.client.processedEvent.deleteMany({
        where: { consumer: TestConsumer.name },
      });
      await app?.close();
    } finally {
      await eventBridge.send(
        new RemoveTargetsCommand({
          Rule: queueName,
          EventBusName: eventBusName,
          Ids: [queueName],
        }),
      );
      await eventBridge.send(
        new DeleteRuleCommand({ Name: queueName, EventBusName: eventBusName }),
      );
      await sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
    }
  });

  it('delivers a domain event once and ignores its redelivery', async () => {
    const aggregate = TestAggregate.happen();
    const [event] = aggregate.getDomainEvents();
    const consumer = app.get(TestConsumer);
    const dispatch = jest.spyOn(
      app.get(EventDispatcher, { strict: false }),
      'dispatch',
    );

    const saved = await app
      .get(UnitOfWork)
      .run(() =>
        new TestRepository(prisma, app.get(DomainEventRecorder)).save(
          aggregate,
        ),
      );
    expect(saved.isOk()).toBe(true);
    await app.get(OutboxPollerService).poll();

    await eventually(async () => {
      expect(consumer.handledEventIds).toEqual([event.eventId]);
      const processed = await prisma.client.processedEvent.findUnique({
        where: {
          consumer_eventId: {
            consumer: TestConsumer.name,
            eventId: event.eventId,
          },
        },
      });
      expect(processed).not.toBeNull();
    });
    const outboxRow = await prisma.client.outboxEvent.findUniqueOrThrow({
      where: { id: event.eventId },
    });
    expect(outboxRow.publishedAt).not.toBeNull();

    await app.get(MessageBroker).publish({
      eventId: event.eventId,
      eventType: event.eventType,
      context,
      payload: JSON.stringify(outboxRow.payload),
    });

    await eventually(() => expect(dispatch).toHaveBeenCalledTimes(2));
    await dispatch.mock.results[1].value;
    expect(consumer.handledEventIds).toEqual([event.eventId]);
  }, 30_000);
});
