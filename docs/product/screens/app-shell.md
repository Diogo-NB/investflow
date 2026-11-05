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
- Início: título "Início | InvestFlow", o rótulo "Início", a saudação "Olá,
  {primeiro nome}." ("Olá." sem primeiro nome) e o subtítulo "Simule, compare
  e acompanhe seus investimentos.". Um erro inesperado mostra uma mensagem
  segura, com a opção de recarregar, dentro da estrutura.
- Ao lado da saudação (abaixo dela em telas estreitas), "Índices do Banco
  Central, ao ano" mostra o último valor publicado de CDI, SELIC e Meta SELIC,
  cada um com sua data, pois as publicações não coincidem. Um índice ainda sem
  valor mostra "—". Enquanto carrega, reserva o espaço; se falhar, mostra "Não
  foi possível carregar os índices." com "Tentar novamente", e o restante do
  Início não é afetado. Aparece também para quem não tem simulações.
- Abaixo da saudação, o Início reúne o que o usuário mais faz, cada bloco
  carregado e, se falhar, tentado de novo por conta própria:
  - "Nova simulação" e "Comparar simulações", que abre a lista.
  - "N simulações requerem ação.", com "Revisar", que abre a lista filtrada
    por "Requer ação"; oculto quando nenhuma requer.
  - "Sua maior rentabilidade líquida": a rentabilidade, a oferta e o emissor
    da primeira simulação em "Maior rentabilidade líquida", marcada quando o
    resultado não está atualizado, com "Ver ranking", que abre a lista nessa
    ordem; oculto enquanto nenhuma simulação tem resultado.
  - "Simulações recentes": as 5 mais recentes, nas mesmas linhas da lista,
    com as caixas "Comparar" e a barra de comparação. A seleção fica no
    endereço, e "Ver todas" e "Comparar simulações" a levam para a lista.
    Atualiza-se sozinho enquanto alguma está sendo calculada.
  - "Planos": os 3 primeiros planos com seus marcadores e "Ver todos", ou
    "Criar plano" quando não há nenhum.
  - Links menores para "Gerenciar ofertas" e "Gerenciar curvas".
- Sem nenhuma simulação, o Início mostra só a saudação, o guia "Comece em
  três passos" (escolher a oferta, informar valor e data, ver o resultado e
  comparar) com "Criar a primeira simulação", e os links de ofertas e
  curvas.
