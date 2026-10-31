import { App } from 'aws-cdk-lib';
import { InvestflowMessagingStack } from './messaging/messaging.stack';

const app = new App();

new InvestflowMessagingStack(app, 'InvestflowMessagingStack', {
  env: { account: process.env['CDK_DEFAULT_ACCOUNT'], region: 'sa-east-1' },
  terminationProtection: true,
});
