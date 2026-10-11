import { CalendarDate } from '@investflow/shared-domain';
import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

export const IS_CALENDAR_DATE = 'isCalendarDate';

export function isCalendarDate(value: unknown): value is string {
  return typeof value === 'string' && CalendarDate.create(value).isOk();
}

export function IsCalendarDate(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_CALENDAR_DATE,
      validator: {
        validate: isCalendarDate,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a valid calendar date in YYYY-MM-DD format`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
