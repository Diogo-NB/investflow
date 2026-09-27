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
  failure.classList.replace('hidden', 'grid');
  failure.querySelector('button')?.addEventListener('click', reload, {
    once: true,
  });
}
