import { useState, type ComponentProps } from 'react';
import { todayInSaoPaulo } from '../dates/calendar-date';
import { DateField } from '../ui/date-field';
import { useNonBusinessDays } from './use-non-business-days';

type BusinessDateFieldProps = Omit<
  ComponentProps<typeof DateField>,
  'isDateUnavailable' | 'onVisibleYearChange'
>;

export function BusinessDateField(props: BusinessDateFieldProps) {
  const [year, setYear] = useState(() => Number(todayInSaoPaulo().slice(0, 4)));
  const isNonBusinessDay = useNonBusinessDays(year);
  return (
    <DateField
      {...props}
      isDateUnavailable={isNonBusinessDay}
      onVisibleYearChange={setYear}
    />
  );
}
