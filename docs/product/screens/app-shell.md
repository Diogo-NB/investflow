# Estrutura do Aplicativo e Acesso

Como o usuário entra, permanece e sai do InvestFlow. Os detalhes de
autenticação estão em "Screen mechanics" em
[Frontend Patterns](../../architecture/frontend-patterns.md).

- Nada do aplicativo aparece antes de a sessão ser confirmada; o login é
  obrigatório. Depois do login, o usuário volta à página que pediu.
- Enquanto a sessão começa, a página mostra "Iniciando sua sessão…". Se ela não
  puder começar, mostra "Não foi possível iniciar sua sessão." com "Tentar
  novamente", sem detalhes técnicos do provedor de identidade.
- Quem usou o aplicativo nos últimos 30 minutos continua conectado sem
  perceber a renovação da sessão. Quem ficou inativo, ou cuja renovação falhou,
  é desconectado e volta à página inicial.
- O usuário é identificado pelo nome, pelo nome de usuário ou pelo e-mail, nessa
  ordem, ou por "Usuário autenticado" quando nenhum existe.
- Sair volta à página inicial. Enquanto sai, o botão mostra "Saindo…" e ignora
  novos cliques. Uma falha mostra "Não foi possível sair. Tente novamente."
  junto ao botão e permite tentar de novo.
- A estrutura tem o atalho "Ir para o conteúdo", o link "InvestFlow, página
  inicial", "Sua conta" com a identificação e "Sair". Cada navegação leva o
  foco ao conteúdo principal sem rolar a página.
- Início: título "Início | InvestFlow", o rótulo "Início", o título
  "Bem-vindo ao InvestFlow." e o subtítulo "Um espaço para suas próximas
  decisões de investimento.". Um erro inesperado mostra uma mensagem segura,
  com a opção de recarregar, dentro da estrutura.
