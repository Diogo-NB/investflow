import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  InvestflowMessagingStack,
  type InvestflowMessagingStackProps,
} from './messaging.stack';

const PROVISION_SCRIPT = join(__dirname, '../../../floci/init/provision.sh');
// The CLI reads the feature flags from cdk.json; a bare App would synthesize
// a different template than the one deployed.
const CDK_CONTEXT = JSON.parse(
  readFileSync(join(__dirname, '../../cdk.json'), 'utf8'),
).context;

interface LocalConsumerQueue {
  readonly name: string;
  readonly eventPattern: unknown;
}

function localConsumerQueues(): LocalConsumerQueue[] {
  const script = readFileSync(PROVISION_SCRIPT, 'utf8');
  return [...script.matchAll(/^consumer_queue (\S+) \\\n\s+'([^']+)'/gm)].map(
    ([, name, pattern]) => ({ name, eventPattern: JSON.parse(pattern) }),
  );
}

const API_SOURCE_IP = '187.41.107.80/32';
const DEAD_LETTER_QUEUES = [
  'event-delivery-dlq',
  'simulation-calculations-dlq.fifo',
  'simulation-recalculations-dlq.fifo',
  'curve-published-index-values-dlq.fifo',
];

function synthesize(
  props: InvestflowMessagingStackProps,
  id = 'InvestflowMessagingStack',
): Template {
  return Template.fromStack(
    new InvestflowMessagingStack(new App({ context: CDK_CONTEXT }), id, props),
  );
}

function logicalId(template: Template, type: string, props: object): string {
  const [id] = Object.keys(template.findResources(type, { Properties: props }));
  return id;
}

describe('InvestflowMessagingStack', () => {
  const template = synthesize({ apiSourceIp: API_SOURCE_IP });
  const consumerQueues = localConsumerQueues();

  it('defines the same consumer queues and event patterns as the local provisioning', () => {
    expect(consumerQueues.map(({ name }) => name)).toEqual([
      'simulation-calculations',
      'simulation-recalculations',
      'curve-published-index-values',
    ]);
    const rules = Object.values(template.findResources('AWS::Events::Rule'));
    expect(
      rules.map(({ Properties }) => ({
        name: Properties.Name,
        eventPattern: Properties.EventPattern,
      })),
    ).toEqual(consumerQueues);
  });

  it.each([
    'simulation-calculations',
    'simulation-recalculations',
    'curve-published-index-values',
  ])(
    'routes %s to a FIFO queue grouped by aggregate, with dead-letter queues',
    (name) => {
      const deadLetterQueueId = logicalId(template, 'AWS::SQS::Queue', {
        QueueName: `${name}-dlq.fifo`,
      });
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: `${name}-dlq.fifo`,
        FifoQueue: true,
        ContentBasedDeduplication: true,
        MessageRetentionPeriod: 1_209_600,
        SqsManagedSseEnabled: true,
      });
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: `${name}.fifo`,
        FifoQueue: true,
        ContentBasedDeduplication: true,
        VisibilityTimeout: 30,
        SqsManagedSseEnabled: true,
        RedrivePolicy: {
          deadLetterTargetArn: { 'Fn::GetAtt': [deadLetterQueueId, 'Arn'] },
          maxReceiveCount: 5,
        },
      });

      const queueId = logicalId(template, 'AWS::SQS::Queue', {
        QueueName: `${name}.fifo`,
      });
      const deliveryDeadLetterQueueId = logicalId(template, 'AWS::SQS::Queue', {
        QueueName: 'event-delivery-dlq',
      });
      template.hasResourceProperties('AWS::Events::Rule', {
        Name: name,
        Targets: [
          Match.objectLike({
            Arn: { 'Fn::GetAtt': [queueId, 'Arn'] },
            SqsParameters: { MessageGroupId: '$.detail.aggregateId' },
            DeadLetterConfig: {
              Arn: { 'Fn::GetAtt': [deliveryDeadLetterQueueId, 'Arn'] },
            },
          }),
        ],
      });
    },
  );

  it('keeps undelivered events in a standard queue for 14 days', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'event-delivery-dlq',
      FifoQueue: Match.absent(),
      MessageRetentionPeriod: 1_209_600,
    });
  });

  it('lets the API user, only from the VPS, publish to the bus and consume its four queues', () => {
    const fromApiServer = {
      IpAddress: { 'aws:SourceIp': API_SOURCE_IP },
    };
    const queueArn = (queueName: string) => ({
      'Fn::GetAtt': [
        logicalId(template, 'AWS::SQS::Queue', { QueueName: queueName }),
        'Arn',
      ],
    });
    const busId = logicalId(template, 'AWS::Events::EventBus', {
      Name: 'investflow',
    });

    template.resourceCountIs('AWS::IAM::User', 1);
    template.hasResourceProperties('AWS::IAM::User', {
      UserName: 'investflow-api',
    });
    const policies = Object.values(template.findResources('AWS::IAM::Policy'));
    expect(
      policies.map(({ Properties }) => Properties.PolicyDocument.Statement),
    ).toEqual([
      [
        {
          Action: 'events:PutEvents',
          Condition: fromApiServer,
          Effect: 'Allow',
          Resource: { 'Fn::GetAtt': [busId, 'Arn'] },
        },
        {
          Action: ['sqs:DeleteMessage', 'sqs:ReceiveMessage'],
          Condition: fromApiServer,
          Effect: 'Allow',
          Resource: [
            queueArn('curve-published-index-values.fifo'),
            queueArn('simulation-calculations.fifo'),
            queueArn('simulation-calculations-dlq.fifo'),
            queueArn('simulation-recalculations.fifo'),
          ],
        },
      ],
    ]);
  });

  it('notifies the address given at deploy time by email', () => {
    const topicId = logicalId(template, 'AWS::SNS::Topic', {
      TopicName: 'investflow-dead-letter-alarms',
    });
    template.hasParameter('AlarmEmail', { Type: 'String' });
    template.resourceCountIs('AWS::SNS::Subscription', 1);
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: { Ref: 'AlarmEmail' },
      TopicArn: { Ref: topicId },
    });
  });

  it('alarms on every dead-letter queue, notifying when it fires and clears', () => {
    const topicArn = {
      Ref: logicalId(template, 'AWS::SNS::Topic', {
        TopicName: 'investflow-dead-letter-alarms',
      }),
    };
    const queueName = (name: string) => ({
      'Fn::GetAtt': [
        logicalId(template, 'AWS::SQS::Queue', { QueueName: name }),
        'QueueName',
      ],
    });
    const alarm = (name: string, metricName: string, statistic: string) => ({
      AlarmName: `${name.replace('.fifo', '')}-messages`,
      MetricName: metricName,
      Namespace: 'AWS/SQS',
      Dimensions: [{ Name: 'QueueName', Value: queueName(name) }],
      Statistic: statistic,
      Period: 60,
      EvaluationPeriods: 1,
      Threshold: 1,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      TreatMissingData: 'notBreaching',
      AlarmActions: [topicArn],
      OKActions: [topicArn],
    });

    const alarms = Object.values(
      template.findResources('AWS::CloudWatch::Alarm'),
    ).map(({ Properties }) => Properties);
    expect(alarms).toHaveLength(DEAD_LETTER_QUEUES.length);
    expect(alarms).toEqual(
      expect.arrayContaining([
        alarm(
          'event-delivery-dlq',
          'ApproximateNumberOfMessagesVisible',
          'Maximum',
        ),
        alarm(
          'simulation-calculations-dlq.fifo',
          'NumberOfMessagesReceived',
          'Sum',
        ),
        alarm(
          'simulation-recalculations-dlq.fifo',
          'ApproximateNumberOfMessagesVisible',
          'Maximum',
        ),
        alarm(
          'curve-published-index-values-dlq.fifo',
          'ApproximateNumberOfMessagesVisible',
          'Maximum',
        ),
      ]),
    );
  });

  describe('in another environment', () => {
    const homolog = synthesize(
      { nameSuffix: 'homolog', experimentAccess: true },
      'InvestflowMessagingStack-homolog',
    );
    const withSuffix = (name: string) =>
      name.endsWith('.fifo')
        ? name.replace(/\.fifo$/, '-homolog.fifo')
        : `${name}-homolog`;

    it('suffixes every resource name, keeping .fifo last, so it does not collide with production', () => {
      homolog.hasResourceProperties('AWS::Events::EventBus', {
        Name: 'investflow-homolog',
      });
      homolog.hasResourceProperties('AWS::IAM::User', {
        UserName: 'investflow-api-homolog',
      });
      homolog.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'investflow-dead-letter-alarms-homolog',
      });
      const queueNames = Object.values(
        homolog.findResources('AWS::SQS::Queue'),
      ).map(({ Properties }) => Properties.QueueName);
      expect(queueNames.sort()).toEqual(
        [
          ...DEAD_LETTER_QUEUES,
          ...consumerQueues.map(({ name }) => `${name}.fifo`),
        ]
          .map(withSuffix)
          .sort(),
      );
      const alarmNames = Object.values(
        homolog.findResources('AWS::CloudWatch::Alarm'),
      ).map(({ Properties }) => Properties.AlarmName);
      expect(alarmNames).toHaveLength(DEAD_LETTER_QUEUES.length);
      expect(
        alarmNames.every((name: string) => name.endsWith('-messages-homolog')),
      ).toBe(true);
    });

    it('lets its API user call AWS from any address', () => {
      const policies = Object.values(homolog.findResources('AWS::IAM::Policy'));
      const statements = policies.flatMap(
        ({ Properties }) => Properties.PolicyDocument.Statement,
      );
      expect(statements).toHaveLength(4);
      expect(statements.every(({ Condition }) => Condition === undefined)).toBe(
        true,
      );
    });

    it('lets its API user drive the experiments on its own queues only', () => {
      const statements = Object.values(
        homolog.findResources('AWS::IAM::Policy'),
      ).flatMap(({ Properties }) => Properties.PolicyDocument.Statement);
      const [queueAccess, accountReads] = statements.slice(2);
      const queueIds = Object.keys(homolog.findResources('AWS::SQS::Queue'));

      expect(queueAccess.Action).toEqual(
        expect.arrayContaining([
          'sqs:GetQueueAttributes',
          'sqs:PurgeQueue',
          'sqs:SendMessage',
          'sqs:StartMessageMoveTask',
        ]),
      );
      expect(
        queueAccess.Resource.map(
          ({ 'Fn::GetAtt': [id] }: { 'Fn::GetAtt': [string] }) => id,
        ).sort(),
      ).toEqual(queueIds.sort());
      expect(accountReads.Resource).toBe('*');
      expect(
        accountReads.Action.every((action: string) =>
          /^[a-z]+:(Describe|Get|List)/.test(action),
        ),
      ).toBe(true);
    });
  });
});
