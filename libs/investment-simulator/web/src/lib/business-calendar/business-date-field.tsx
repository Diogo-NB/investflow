import type { ComponentProps } from 'react';
import { DateField } from '../ui/date-field';
import { useBusinessCalendar } from './use-business-calendar';

type BusinessDateFieldProps = Omit<
  ComponentProps<typeof DateField>,
  'isDateUnavailable'
>;

/**
 * A date field whose calendar offers only business days within the accepted
 * years, narrowed further by `min` and `max`.
 */
export function BusinessDateField({
  min,
  max,
  ...props
}: BusinessDateFieldProps) {
  const { state } = useBusinessCalendar();
  if (state.status !== 'ready')
    return <DateField {...props} min={min} max={max} />;
  const { calendar } = state;
  return (
    <DateField
      // A narrower lower bound, such as an interval's start, is where an
      // empty calendar should open.
      openTo={min}
      {...props}
      min={min && min > calendar.first ? min : calendar.first}
      max={max && max < calendar.last ? max : calendar.last}
      isDateUnavailable={(isoDate) => !calendar.isBusinessDay(isoDate)}
    />
  );
}
