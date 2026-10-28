import { Toast } from '@base-ui/react/toast';
import { Link } from 'react-router';

// What a context may attach to a toast beyond its text and action.
export interface AppToastData {
  readonly link?: { readonly to: string; readonly label: string };
}

export const TOAST_TIMEOUT_MS = 10_000;

const toastButton =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control px-3 font-medium text-accent no-underline hover:bg-accent-soft';

// Rendered once in the shell, inside the router so links work, and outside
// the routes so a toast outlives the page that raised it.
export function AppToasts() {
  const { toasts, close } = Toast.useToastManager<AppToastData>();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed inset-x-4 bottom-4 z-30 flex flex-col gap-3 outline-none sm:left-auto sm:w-96">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="group grid translate-x-(--toast-swipe-movement-x) translate-y-(--toast-swipe-movement-y) grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 rounded-surface border border-border bg-surface py-2 pr-2 pl-4 text-fg transition-[opacity,translate] duration-200 ease-out data-ending-style:opacity-0 data-limited:hidden data-starting-style:translate-y-2 data-starting-style:opacity-0 motion-reduce:transition-none"
          >
            <div className="col-start-1 row-start-1 grid min-w-0 gap-1 py-2">
              <Toast.Title className="m-0 text-base/snug font-medium" />
              <Toast.Description className="m-0 text-sm text-muted group-data-[type=error]:text-error" />
            </div>
            {(toast.actionProps || toast.data?.link) && (
              <div className="col-span-2 row-start-2 -mt-1 -ml-3 flex flex-wrap gap-2 pb-1">
                <Toast.Action className={toastButton} />
                {toast.data?.link && (
                  <Link
                    to={toast.data.link.to}
                    className={toastButton}
                    onClick={() => close(toast.id)}
                  >
                    {toast.data.link.label}
                  </Link>
                )}
              </div>
            )}
            {/* After the actions, so Tab reaches them first. */}
            <Toast.Close
              aria-label="Fechar"
              className="col-start-2 row-start-1 inline-flex size-11 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-accent-soft hover:text-fg"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="size-5"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
