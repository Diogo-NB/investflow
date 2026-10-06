import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateOfferCommand,
  CreateOfferOutput,
  CreateOfferUseCase,
  DeleteOfferCommand,
  DeleteOfferUseCase,
  UpdateOfferCommand,
  UpdateOfferUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import { CreateOfferRequest } from './requests/create-offer.request';
import { OfferIdRequest } from './requests/offer-id.request';
import { UpdateOfferRequest } from './requests/update-offer.request';
import { SkipTransaction } from '@investflow/shared-infrastructure';
import { ListOffersQueryHandler } from '../queries/list-offers.query-handler';
import { GetOfferQueryHandler } from '../queries/get-offer.query-handler';
import { ListOffersRequest } from './requests/list-offers.request';
import { OfferPresenter } from './offer.presenter';

@Controller('investment-simulator/offers')
export class OfferController {
  constructor(
    private readonly createOffer: CreateOfferUseCase,
    private readonly updateOffer: UpdateOfferUseCase,
    private readonly deleteOffer: DeleteOfferUseCase,
    private readonly listOffers: ListOffersQueryHandler,
    private readonly getOffer: GetOfferQueryHandler,
  ) {}

  @Get()
  @SkipTransaction()
  async list(@Query() query: ListOffersRequest) {
    return (await this.listOffers.execute(query)).map(OfferPresenter.page);
  }

  @Get(':offerId')
  @SkipTransaction()
  async get(@Param() params: OfferIdRequest) {
    return (await this.getOffer.execute(params)).map(OfferPresenter.present);
  }

  @Post()
  create(
    @Body() request: CreateOfferRequest,
  ): Promise<Result<CreateOfferOutput, AppError>> {
    return this.createOffer.execute(CreateOfferCommand.fromRequest(request));
  }

  @Patch(':offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(
    @Param() params: OfferIdRequest,
    @Body() request: UpdateOfferRequest,
  ): Promise<Result<void, AppError>> {
    return this.updateOffer.execute(
      UpdateOfferCommand.fromRequest(params, request),
    );
  }

  @Delete(':offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param() params: OfferIdRequest): Promise<Result<void, AppError>> {
    return this.deleteOffer.execute(DeleteOfferCommand.fromRequest(params));
  }
}
