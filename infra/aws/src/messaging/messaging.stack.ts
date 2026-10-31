import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { EventBus, EventPattern, Rule } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, User } from 'aws-cdk-lib/aws-iam';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

interface ConsumerQueue {
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;
}

const DEAD_LETTER_RETENTION = Duration.days(14);
// The VPS's public IPv4, the address of vps.diogo-nb.com.br. The API user's
// key works only from it, so a leaked key is useless elsewhere; moving the
// API to another server means changing this first.
const API_SOURCE_IP = '187.41.107.80/32';

// Production counterpart of infra/floci/init/provision.sh; its spec keeps the
// consumer queues and their event patterns identical to that script's. Names
// are fixed because the API's configuration builds the queue URLs from them.
export class InvestflowMessagingStack extends Stack {
  private readonly bus: EventBus;
  private readonly deliveryDeadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bus = new EventBus(this, 'EventBus', { eventBusName: 'investflow' });
    // Keeps the events EventBridge fails to deliver to a queue, which would
    // otherwise be dropped. EventBridge only accepts a standard queue here.
    this.deliveryDeadLetterQueue = new Queue(this, 'EventDeliveryDlq', {
      queueName: 'event-delivery-dlq',
      retentionPeriod: DEAD_LETTER_RETENTION,
      encryption: QueueEncryption.SQS_MANAGED,
    });

    const calculations = this.consumerQueue('simulation-calculations', {
      source: ['investflow.investment-simulator'],
      detailType: [
        'SimulationCreated',
        'SimulationEdited',
        'SimulationCalculationRequested',
      ],
    });
    const recalculations = this.consumerQueue('simulation-recalculations', {
      source: ['investflow.investment-simulator'],
      detailType: [
        'OfferTermsChanged',
        'OfferDeleted',
        'CurveValuesChanged',
        'CurveDeleted',
      ],
    });

    // The API publishes to the bus and consumes three queues; no consumer reads
    // the recalculations dead-letter queue.
    const apiUser = new User(this, 'ApiUser', { userName: 'investflow-api' });
    const fromApiServer = { IpAddress: { 'aws:SourceIp': API_SOURCE_IP } };
    apiUser.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [this.bus.eventBusArn],
        conditions: fromApiServer,
      }),
    );
    apiUser.addToPrincipalPolicy(
      new PolicyStatement({
        actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage'],
        resources: [
          calculations.queue.queueArn,
          calculations.deadLetterQueue.queueArn,
          recalculations.queue.queueArn,
        ],
        conditions: fromApiServer,
      }),
    );

    new CfnOutput(this, 'EventBusName', { value: this.bus.eventBusName });
    new CfnOutput(this, 'SimulationCalculationsQueueUrl', {
      value: calculations.queue.queueUrl,
    });
    new CfnOutput(this, 'SimulationCalculationsDlqUrl', {
      value: calculations.deadLetterQueue.queueUrl,
    });
    new CfnOutput(this, 'SimulationRecalculationsQueueUrl', {
      value: recalculations.queue.queueUrl,
    });
    new CfnOutput(this, 'ApiUserName', { value: apiUser.userName });
  }

  // A FIFO queue with its FIFO dead-letter queue, fed by a rule. Messages are
  // grouped by aggregate, so one message per aggregate is in flight at a time.
  // EventBridge sends no deduplication id, so the queues deduplicate by
  // content. A message is dead-lettered after 5 failed receives.
  private consumerQueue(
    name: string,
    eventPattern: EventPattern,
  ): ConsumerQueue {
    const deadLetterQueue = new Queue(this, `${name}-dlq`, {
      queueName: `${name}-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: DEAD_LETTER_RETENTION,
      encryption: QueueEncryption.SQS_MANAGED,
    });
    const queue = new Queue(this, name, {
      queueName: `${name}.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: Duration.seconds(30),
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 5 },
      encryption: QueueEncryption.SQS_MANAGED,
    });

    new Rule(this, `${name}-rule`, {
      ruleName: name,
      eventBus: this.bus,
      eventPattern,
    }).addTarget(
      new SqsQueue(queue, {
        messageGroupId: '$.detail.aggregateId',
        deadLetterQueue: this.deliveryDeadLetterQueue,
      }),
    );

    return { queue, deadLetterQueue };
  }
}
