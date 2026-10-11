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
  DuplicateOfferCommand,
  DuplicateOfferOutput,
  DuplicateOfferUseCase,
  EditOfferCommand,
  EditOfferUseCase,
} from '@investflow/investment-simulator-application';
import { AppError, Result } from '@investflow/shared-domain';
import {
  CurrentUser,
  SkipTransaction,
} from '@investflow/shared-infrastructure';
import type { AuthenticatedUser } from '@investflow/shared-types';
import { GetOfferQueryHandler } from '../queries/get-offer.query-handler';
import { ListOffersQueryHandler } from '../queries/list-offers.query-handler';
import { CreateOfferRequest } from './requests/create-offer.request';
import { EditOfferRequest } from './requests/edit-offer.request';
import { ListOffersRequest } from './requests/list-offers.request';
import { OfferIdRequest } from './requests/offer-id.request';

@Controller('investment-simulator/offers')
export class OfferController {
  constructor(
    private readonly createOffer: CreateOfferUseCase,
    private readonly editOffer: EditOfferUseCase,
    private readonly duplicateOffer: DuplicateOfferUseCase,
    private readonly deleteOffer: DeleteOfferUseCase,
    private readonly listOffers: ListOffersQueryHandler,
    private readonly getOffer: GetOfferQueryHandler,
  ) {}

  @Get()
  @SkipTransaction()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOffersRequest,
  ) {
    return this.listOffers.execute({ ...query, viewerId: user.userId });
  }

  @Get(':offerId')
  @SkipTransaction()
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: OfferIdRequest) {
    return this.getOffer.execute({ ...params, viewerId: user.userId });
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() request: CreateOfferRequest,
  ): Promise<Result<CreateOfferOutput, AppError>> {
    return this.createOffer.execute(
      CreateOfferCommand.fromRequest(user.userId, request),
    );
  }

  @Patch(':offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OfferIdRequest,
    @Body() request: EditOfferRequest,
  ): Promise<Result<void, AppError>> {
    return this.editOffer.execute(
      EditOfferCommand.fromRequest(user.userId, params, request),
    );
  }

  @Post(':offerId/duplicates')
  duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OfferIdRequest,
  ): Promise<Result<DuplicateOfferOutput, AppError>> {
    return this.duplicateOffer.execute(
      DuplicateOfferCommand.fromRequest(user.userId, params),
    );
  }

  @Delete(':offerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: OfferIdRequest,
  ): Promise<Result<void, AppError>> {
    return this.deleteOffer.execute(
      DeleteOfferCommand.fromRequest(user.userId, params),
    );
  }
}
