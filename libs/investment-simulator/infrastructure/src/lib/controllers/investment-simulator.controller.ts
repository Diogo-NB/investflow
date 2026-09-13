import { Controller, Get } from '@nestjs/common';
import { Public, SkipTransaction } from '@investflow/shared-infrastructure';

export interface InvestmentSimulatorHelloResponse {
  readonly message: string;
}

@Controller('investment-simulator')
export class InvestmentSimulatorController {
  @Public()
  @SkipTransaction()
  @Get('hello')
  hello(): InvestmentSimulatorHelloResponse {
    return { message: 'Hello World' };
  }
}
