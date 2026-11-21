import {
  CfnOutput,
  CfnParameter,
  Duration,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import {
  Alarm,
  ComparisonOperator,
  IMetric,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { EventBus, EventPattern, Rule } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, User } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface InvestflowMessagingStackProps extends StackProps {
  // Appended to every resource name so a second environment can live in the
  // same account; production has none, so its names stay those it was first
  // deployed with.
  readonly nameSuffix?: string;
  // The only address the API user's key works from; without it the key
  // works from anywhere.
  readonly apiSourceIp?: string;
}

interface ConsumerQueue {
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;
}

const DEAD_LETTER_RETENTION = Duration.days(14);
const ALARM_PERIOD = Duration.minutes(1);

// AWS counterpart of infra/floci/init/provision.sh; its spec keeps the
// consumer queues and their event patterns identical to that script's.
export class InvestflowMessagingStack extends Stack {
  private readonly nameSuffix: string;
  private readonly bus: EventBus;
  private readonly deliveryDeadLetterQueue: Queue;
  private readonly alarmAction: SnsAction;

  constructor(
    scope: Construct,
    id: string,
    props: InvestflowMessagingStackProps = {},
  ) {
    super(scope, id, props);
    this.nameSuffix = props.nameSuffix ? `-${props.nameSuffix}` : '';

    // A parameter, not a prop, so the address never enters the repository
    // or the synthesized template; deploys after the first reuse its value.
    const alarmEmail = new CfnParameter(this, 'AlarmEmail', {
      type: 'String',
      description: 'Address notified when a dead-letter queue holds messages',
    });
    const alarmTopic = new Topic(this, 'DeadLetterAlarmTopic', {
      topicName: this.resourceName('investflow-dead-letter-alarms'),
    });
    alarmTopic.addSubscription(new EmailSubscription(alarmEmail.valueAsString));
    this.alarmAction = new SnsAction(alarmTopic);

    this.bus = new EventBus(this, 'EventBus', {
      eventBusName: this.resourceName('investflow'),
    });
    // Keeps the events EventBridge fails to deliver to a queue, which would
    // otherwise be dropped. EventBridge only accepts a standard queue here.
    this.deliveryDeadLetterQueue = new Queue(this, 'EventDeliveryDlq', {
      queueName: this.resourceName('event-delivery-dlq'),
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
    const publishedIndexValues = this.consumerQueue(
      'curve-published-index-values',
      {
        source: ['investflow.market-data'],
        detailType: ['PublishedIndexValuesImported'],
      },
    );

    // Messages wait in the dead-letter queues no consumer reads until someone
    // redrives them, so the alarm stays on until then. The calculations one
    // is read by SimulationCalculationFailureConsumer, which deletes each
    // message within seconds, before a one-minute sample of the visible
    // count may see it; its receives are counted instead.
    this.alarmWhenMessagesWait(
      'event-delivery-dlq',
      this.deliveryDeadLetterQueue,
    );
    this.alarmWhenMessagesReceived(
      'simulation-calculations-dlq',
      calculations.deadLetterQueue,
    );
    this.alarmWhenMessagesWait(
      'simulation-recalculations-dlq',
      recalculations.deadLetterQueue,
    );
    this.alarmWhenMessagesWait(
      'curve-published-index-values-dlq',
      publishedIndexValues.deadLetterQueue,
    );

    // The API publishes to the bus and consumes four queues; no consumer reads
    // the recalculations or published index values dead-letter queues.
    const apiUser = new User(this, 'ApiUser', {
      userName: this.resourceName('investflow-api'),
    });
    const fromApiServer = props.apiSourceIp
      ? { IpAddress: { 'aws:SourceIp': props.apiSourceIp } }
      : undefined;
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
          publishedIndexValues.queue.queueArn,
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
    new CfnOutput(this, 'CurvePublishedIndexValuesQueueUrl', {
      value: publishedIndexValues.queue.queueUrl,
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
      queueName: this.resourceName(`${name}-dlq.fifo`),
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: DEAD_LETTER_RETENTION,
      encryption: QueueEncryption.SQS_MANAGED,
    });
    const queue = new Queue(this, name, {
      queueName: this.resourceName(`${name}.fifo`),
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

  private alarmWhenMessagesWait(name: string, deadLetterQueue: Queue): void {
    // ApproximateNumberOfMessagesVisible, because messages the redrive policy
    // moves are not counted in NumberOfMessagesSent.
    this.deadLetterAlarm(
      name,
      deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: ALARM_PERIOD,
        statistic: 'Maximum',
      }),
    );
  }

  private alarmWhenMessagesReceived(
    name: string,
    deadLetterQueue: Queue,
  ): void {
    this.deadLetterAlarm(
      name,
      deadLetterQueue.metricNumberOfMessagesReceived({
        period: ALARM_PERIOD,
        statistic: 'Sum',
      }),
    );
  }

  // An idle queue emits no data points, which must read as no messages. The
  // address is notified both when the alarm fires and when it clears.
  private deadLetterAlarm(name: string, metric: IMetric): void {
    const alarm = new Alarm(this, `${name}-alarm`, {
      alarmName: this.resourceName(`${name}-messages`),
      metric,
      threshold: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(this.alarmAction);
    alarm.addOkAction(this.alarmAction);
  }

  // A FIFO queue's name must end in .fifo, so the suffix goes before it.
  private resourceName(name: string): string {
    const fifo = '.fifo';
    return name.endsWith(fifo)
      ? `${name.slice(0, -fifo.length)}${this.nameSuffix}${fifo}`
      : `${name}${this.nameSuffix}`;
  }
}
