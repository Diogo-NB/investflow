import Keycloak from 'keycloak-js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { appRoutes } from './app/app-routes';
import { AuthSessionContext } from './app/auth/auth-context';
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

startAuthentication(new Keycloak(environment.keycloak), window.location)
  .then((session) => {
    // Created after init, which removes Keycloak's callback fragment from the URL.
    const router = createBrowserRouter(appRoutes);
    createRoot(root).render(
      <StrictMode>
        <AuthSessionContext value={session}>
          <RouterProvider router={router} />
        </AuthSessionContext>
      </StrictMode>,
    );
  })
  .catch(showStartupFailure);
