import { Controller, Get } from '@nestjs/common';
import { SkipTransaction } from '@investflow/shared-infrastructure';

export interface InvestmentSimulatorHelloResponse {
  readonly message: string;
}

@Controller('investment-simulator')
export class InvestmentSimulatorController {
  @SkipTransaction()
  @Get('hello')
  hello(): InvestmentSimulatorHelloResponse {
    return { message: 'Hello World' };
  }
}
