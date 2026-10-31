import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { InvestflowMessagingStack } from './messaging.stack';

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

function logicalId(template: Template, type: string, props: object): string {
  const [id] = Object.keys(template.findResources(type, { Properties: props }));
  return id;
}

describe('InvestflowMessagingStack', () => {
  const template = Template.fromStack(
    new InvestflowMessagingStack(
      new App({ context: CDK_CONTEXT }),
      'InvestflowMessagingStack',
    ),
  );
  const consumerQueues = localConsumerQueues();

  it('defines the same consumer queues and event patterns as the local provisioning', () => {
    expect(consumerQueues.map(({ name }) => name)).toEqual([
      'simulation-calculations',
      'simulation-recalculations',
    ]);
    const rules = Object.values(template.findResources('AWS::Events::Rule'));
    expect(
      rules.map(({ Properties }) => ({
        name: Properties.Name,
        eventPattern: Properties.EventPattern,
      })),
    ).toEqual(consumerQueues);
  });

  it.each(['simulation-calculations', 'simulation-recalculations'])(
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

  it('lets the API user, only from the VPS, publish to the bus and consume its three queues', () => {
    const fromApiServer = {
      IpAddress: { 'aws:SourceIp': '187.41.107.80/32' },
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
            queueArn('simulation-calculations.fifo'),
            queueArn('simulation-calculations-dlq.fifo'),
            queueArn('simulation-recalculations.fifo'),
          ],
        },
      ],
    ]);
  });
});
