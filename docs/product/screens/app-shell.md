# App Shell And Authentication Behavior

Recorded from the earlier implementation on 2026-10-10. `apps/web` implements
it.

- Nothing authenticated renders before Keycloak confirms a session. Login is
  required, using Authorization Code + PKCE S256.
- Login returns to the requested path and query, without the fragment.
- While the session starts, the page shows "Iniciando sua sessão…". A failed
  or unauthenticated start shows "Não foi possível iniciar sua sessão." with
  "Tentar novamente" (reload). Provider details are never shown.
- When the access token expires, users active in the last 30 minutes
  (pointer, touch, key, click, or scroll) are refreshed silently. Inactive
  users, and users whose refresh fails, are logged out to the app origin.
- The identity shown is the first non-blank string claim among `name`,
  `preferred_username`, and `email`, falling back to "Usuário autenticado". It
  follows token refreshes.
- Logout returns to the app origin. While pending, the action reads "Saindo…"
  and ignores repeats. A failure shows "Não foi possível sair. Tente
  novamente." as an alert linked to the button, and allows a retry.
- Only relative `/api` and `/api/...` requests carry the bearer, refreshed
  first (built with the first API consumer; see Authentication).
- The shell has the skip link "Ir para o conteúdo", the home link "InvestFlow,
  página inicial", "Sua conta" with the identity, and "Sair". Each navigation
  moves focus to the main landmark without scrolling.
- Home: title "Início | InvestFlow", an "Início" section label, the heading
  "Bem-vindo ao InvestFlow.", and the subtitle "Um espaço para suas próximas
  decisões de investimento.". Unexpected render errors show a safe message
  with a reload action inside the shell.
