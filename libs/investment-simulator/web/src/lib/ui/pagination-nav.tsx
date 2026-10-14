import { Link, useSearchParams } from 'react-router';
import { withPage } from '../pagination/page-search';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { quietButton } from './styles';

export function PaginationNav({
  label,
  page,
  lastPage,
}: {
  readonly label: string;
  readonly page: number;
  readonly lastPage: number;
}) {
  const [searchParams] = useSearchParams();
  if (lastPage <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      {page > 1 ? (
        <Link
          to={{ search: withPage(searchParams, page - 1) }}
          className={`${quietButton} gap-1`}
        >
          <ChevronLeftIcon className="size-4 shrink-0" />
          Anterior
        </Link>
      ) : null}
      <span className="px-2 text-sm text-muted" aria-live="polite">
        Página {page} de {lastPage}
      </span>
      {page < lastPage ? (
        <Link
          to={{ search: withPage(searchParams, page + 1) }}
          className={`${quietButton} gap-1`}
        >
          Próxima
          <ChevronRightIcon className="size-4 shrink-0" />
        </Link>
      ) : null}
    </nav>
  );
}
