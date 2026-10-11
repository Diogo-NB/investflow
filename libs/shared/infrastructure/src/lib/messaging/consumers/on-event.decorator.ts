import { SetMetadata } from '@nestjs/common';

export const ON_EVENT_KEY = 'ON_EVENT';
export const OnEvent = (eventType: string) =>
  SetMetadata(ON_EVENT_KEY, eventType);
