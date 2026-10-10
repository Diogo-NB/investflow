import { Application } from '@investflow/investment-simulator-domain';
import { Repository } from '@investflow/shared-domain';

export abstract class ApplicationRepository extends Repository<Application> {}
