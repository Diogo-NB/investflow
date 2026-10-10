import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Keycloak from 'keycloak-js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createAppRoutes } from './app/app-routes';
import { AuthSessionContext } from './app/auth/auth-context';
import { createAuthorizedFetch } from './app/auth/authorized-fetch';
import { startAuthentication } from './app/auth/session';
import { environment } from './environments/environment';
import './styles.css';

const root = document.getElementById('root')!;

// React never mounts without a session, so the static markup in index.html covers loading and failure.
function showStartupFailure() {
  root
    .querySelector<HTMLElement>('#authentication-loading')
    ?.setAttribute('hidden', '');
  const failure = root.querySelector<HTMLElement>('#authentication-failure');
  failure?.removeAttribute('hidden');
  failure
    ?.querySelector('button')
    ?.addEventListener('click', () => window.location.reload(), { once: true });
}

const keycloak = new Keycloak(environment.keycloak);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    // A lost response may hide a committed write, so writes never retry.
    mutations: { retry: 0 },
  },
});

startAuthentication(keycloak, window.location)
  .then((session) => {
    // Created after init, which removes Keycloak's callback fragment from the URL.
    const router = createBrowserRouter(
      createAppRoutes({ fetch: createAuthorizedFetch(keycloak) }),
    );
    createRoot(root).render(
      <StrictMode>
        <AuthSessionContext value={session}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AuthSessionContext>
      </StrictMode>,
    );
  })
  .catch(showStartupFailure);
