import { App } from 'aws-cdk-lib';
import { InvestflowMessagingStack } from './messaging/messaging.stack';

const PRODUCTION = 'production';
// The VPS's public IPv4, the address of vps.diogo-nb.com.br. Production's API
// user key works only from it, so a leaked key is useless elsewhere; moving
// the API to another server means changing this first.
const PRODUCTION_API_SOURCE_IP = '187.41.107.80/32';

const app = new App();
const environment = app.node.tryGetContext('environment') ?? PRODUCTION;
if (!/^[a-z][a-z0-9-]*$/.test(environment)) {
  throw new Error(
    `Invalid environment "${environment}": use lowercase letters, digits, and hyphens.`,
  );
}
const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: 'sa-east-1',
};

// Production keeps the stack id and names it was first deployed with. Any
// other environment is a disposable copy, named after it so it can be
// destroyed.
if (environment === PRODUCTION) {
  new InvestflowMessagingStack(app, 'InvestflowMessagingStack', {
    env,
    terminationProtection: true,
    apiSourceIp: PRODUCTION_API_SOURCE_IP,
  });
} else {
  new InvestflowMessagingStack(app, `InvestflowMessagingStack-${environment}`, {
    env,
    nameSuffix: environment,
  });
}
