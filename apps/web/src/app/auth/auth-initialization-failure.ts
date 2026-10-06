export function renderAuthenticationInitializationFailure(
  document: Document,
  reload: () => void = () => document.location.reload(),
): void {
  const failure = document.getElementById(
    'authentication-initialization-failure',
  );

  if (!failure) {
    return;
  }

  failure.hidden = false;
  const loading = document.getElementById('authentication-loading');
  if (loading) {
    loading.hidden = true;
  }
  failure.querySelector('button')?.addEventListener('click', reload, {
    once: true,
  });
}
