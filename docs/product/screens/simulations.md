# Telas de Simulações

Uma simulação sempre usa uma oferta e, quando a remuneração é indexada, uma
curva, e guarda o valor aplicado e a data da aplicação. Tudo isso é editável.
Seu único resultado é recalculado de forma assíncrona sempre que algo muda. As
regras estão no [PRD](../investment-simulator-prd.md).

## Lista

`/simulacoes` lista as simulações do usuário, 20 por página.

- Uma barra de filtros restringe a lista por busca no apelido ou emissor da
  oferta ("Buscar por oferta ou emissor") e por oferta, curva, tipo de título, tipo
  de remuneração e situação do cálculo, com "Limpar filtros".
  - Uma oferta ou curva que não existe mais aparece como "Oferta excluída" ou
    "Curva excluída". Não há filtro por índice: o tipo de remuneração já o
    define. Ofertas que ainda não podem ser calculadas continuam selecionáveis,
    e "Calculada" avisa que inclui resultados desatualizados.
  - A barra se organiza pela própria largura, pois o diálogo de planos a reusa:
    abaixo de 36rem (cerca de 656px nesta página), os filtros se recolhem em
    "Filtros (N)", com N contando os filtros ativos, inclusive a busca.
- Uma linha acima da lista informa o total ("N simulações", ou "N simulações
  encontradas" quando filtrada) e "Atualizando simulações…" enquanto outra
  página ou filtro carrega, com as linhas anteriores esmaecidas. Limpar os
  filtros leva o foco a essa linha.
- "Ordenar por" oferece "Mais recentes" (padrão) e "Maior rentabilidade
  líquida", que ordena pela rentabilidade líquida anual para o usuário achar a
  melhor opção entre muitas. Simulações sem resultado bem sucedido vêm por
  último, e uma desatualizada é ordenada pelo último resultado, ainda marcada.
  Mudar a ordem volta à primeira página. Ordenar não é filtrar: com os filtros
  recolhidos, a ordem continua visível ao lado de "Filtros (N)" e não conta em
  N.
- Filtros, ordem, página e seleção ficam no endereço da página e acompanham o
  usuário até uma simulação e de volta à lista, inclusive depois de excluí-la.
  Mudar um filtro volta à primeira página.
- Uma busca sem resultados diz "Nenhuma simulação corresponde aos filtros."
  com "Limpar filtros", diferente de não haver simulações.
- Cada linha mostra a oferta pelos termos ("CDB 110% do CDI"), com o emissor
  ("Sem emissor") e o apelido abaixo, a curva quando indexada ("Curva
  excluída" depois de excluída, "—" sem curva), o valor aplicado, o período,
  o valor líquido do último resultado bem sucedido, sua rentabilidade líquida anual
  ("10,28% a.a.", ou "—" sem resultado) e um marcador em texto quando o
  resultado não está atualizado ("Calculando", "Requer ação", "Falha
  técnica"). No desktop é uma tabela com colunas de largura fixa e o período
  em duas linhas; abaixo de 1280px, linhas rotuladas. A linha inteira abre a
  simulação.
- Cada linha tem a caixa "Comparar {oferta}" no lugar do ícone da oferta. A
  seleção, de 2 a 6 simulações, se mantém entre filtros, ordem e páginas. Com
  seis, as demais caixas ficam desabilitadas. Enquanto houver seleção, uma
  barra presa ao fim da lista mostra "N selecionadas", "Limpar" e "Comparar",
  desabilitado abaixo de duas com uma dica; leitores de tela a anunciam.

## Comparação

`/simulacoes/comparar` compara de 2 a 6 simulações, sem guardar nada.

- A tela se atualiza sozinha enquanto alguma simulação está sendo calculada.
  Uma simulação excluída ou desconhecida mostra que uma simulação não foi
  encontrada, com link de volta à seleção. Com menos de duas válidas, volta à
  lista com elas selecionadas.
- Um veredito no topo responde qual rende mais: a líder pela rentabilidade
  líquida anual (empates nomeados juntos), a diferença de cada outra em p.p. e,
  somente quando os valores são comparáveis (mesmo valor aplicado, data da
  aplicação e vencimento), em R$. Ele diz quando só uma tem resultado, nomeia
  as que não têm e chama a comparação de provisória enquanto alguma não está
  atualizada. Resultados desatualizados continuam no ranking, marcados como
  "Resultado anterior".
- No desktop, uma tabela com uma coluna por simulação, na ordem da seleção,
  para que as colunas não mudem de lugar enquanto os resultados chegam, com a
  coluna de rótulos fixa e os grupos Premissas, Líquido, Tributos e Bruto. O
  cabeçalho de cada coluna leva à simulação e mostra a posição, a oferta pelos
  termos com o emissor e o apelido abaixo, a situação e um botão de remover.
  O veredito nomeia cada simulação pelos termos e só acrescenta o emissor e o
  apelido, e depois o valor aplicado e a data da aplicação, enquanto outra
  simulação comparada tiver os mesmos; quando só esses distinguem duas
  simulações da mesma oferta, o cabeçalho também os mostra. A melhor linha
  classificada leva "Melhor", em texto e ícone, e a diferença aparece abaixo
  das demais. Abaixo de 1024px, cartões
  classificados com a rentabilidade, o montante líquido, o IR e a liquidez, e
  "Detalhes" com todas as linhas. "Mostrar só diferenças" esconde as linhas
  com todos os valores iguais.
- "Adicionar" e o caminho de navegação voltam à lista com a seleção. "Comparar
  com…" na simulação abre a lista com ela já selecionada.

## Simulação

`/simulacoes/nova` e `/simulacoes/:id` mostram as premissas ao lado dos
resultados (empilhados abaixo de 1024px). O título de uma simulação salva é a
oferta pelos termos ("CDB 112% do CDI"); abaixo vêm o emissor, o apelido, o
valor aplicado, o período e a origem da oferta.

- "Oferta": escolhida entre as ofertas visíveis ao usuário (do sistema e
  próprias), agrupadas por tipo de título e origem ("CDB · Do sistema", "CDB ·
  Minhas"), com o tipo de título acompanhado de seu tratamento de IR e prazo
  mínimo.
  - Abaixo da oferta escolhida ficam "Editar oferta" (só numa oferta
    própria), "Duplicar e ajustar" e "Nova oferta". Cada modo abre ali
    mesmo, com um cabeçalho que o nomeia e uma linha que diz o que acontece
    ao salvar.
  - "Editar oferta" ("Oferta · Editando") torna editáveis os termos da
    oferta, com o tipo de título como informação fixa e sem a escolha de
    oferta. As alterações valem para a oferta em todas as simulações que a
    usam. Quando mudam o vencimento, a remuneração ou a taxa e outras
    simulações usam a oferta, um aviso informa: "Outras N simulações que
    usam esta oferta também serão recalculadas." ("Outra simulação que usa
    esta oferta também será recalculada." para uma). Se o índice muda, o
    aviso acrescenta que elas ficarão em "Requer ação" até que cada uma
    seja salva com uma curva do novo índice, ou sem curva numa oferta
    prefixada. "Salvar como nova oferta" transforma a edição numa cópia com
    o que foi digitado; "Descartar alterações da oferta" volta aos termos
    salvos e mantém o investimento.
  - "Duplicar e ajustar" ("Nova oferta · cópia de CDB 110% do CDI") abre os
    termos da oferta como uma cópia editável; "Nova oferta" abre termos em
    branco (tipo de título, emissor e apelido opcionais e termos). Nos dois
    casos a linha informa "Será criada em Ofertas › Minhas ao salvar.", e a
    cópia acrescenta que a oferta original não muda. "Voltar à oferta
    escolhida" descarta os termos ("Usar uma oferta existente" quando nenhuma
    foi escolhida).
  - Salvar grava a oferta primeiro e depois a simulação, que só é enviada
    quando suas próprias entradas mudaram. Toda oferta criada é anunciada
    ("Oferta CDB 115% do CDI criada em Minhas", com "Ver oferta"). Uma
    oferta recusada não salva nada e mostra o motivo no campo. Se a
    simulação for recusada depois, a oferta continua salva e escolhida, e o
    investimento continua com as edições não salvas e o motivo no campo. Se
    a oferta foi alterada em outro lugar durante a edição, a seção avisa e
    oferece "Recarregar oferta", que troca só os termos e mantém o
    investimento.
  - Mudar o tipo de remuneração limpa a taxa e a curva. A liquidez começa em
    "No vencimento".
- "Investimento": valor aplicado, data da aplicação e a curva, nos tipos
  indexados. As curvas são filtradas pelo índice da oferta e agrupadas por
  origem ("Do sistema", "Minhas"); uma curva única é escolhida sozinha e
  mostra sua cobertura com o último valor mantido em diante. Quando a data da
  aplicação é anterior à curva, mostra um aviso ("A curva começa em 01/01/2024
  e não cobre a data da aplicação.").
- Os calendários da aplicação e do vencimento apagam fins de semana e
  feriados. Datas digitadas não são bloqueadas pelo calendário: o formulário
  recusa uma fora dos anos aceitos, e o sistema recusa um dia não útil no seu
  campo.
- "Salvar e calcular" fica desabilitado sem alterações. O texto abaixo dele
  diz o que salvar faz: "Salvar altera a oferta e recalcula esta simulação."
  ("…esta e outras N simulações."; "Salvar altera a oferta e cria a
  simulação." numa simulação nova; "Salvar altera a oferta." quando só o
  apelido, o emissor ou a liquidez mudam) ao editar a oferta e "Salvar cria a
  oferta e calcula a simulação." numa nova oferta. Uma simulação recusada
  não é salva: o formulário mantém as edições como não salvas e o motivo
  aparece no campo responsável (valor aplicado, dia não útil, prazo mínimo,
  índice, oferta ou curva ausente). Se a simulação foi alterada em outro lugar,
  salvar avisa e oferece recarregar. Uma simulação nova aceita abre sua
  própria página, já aguardando o cálculo.

### Situação do Cálculo

- O painel de resultados sempre mostra a situação do cálculo e sua causa
  ("Calculando · simulação alterada"), anunciada a leitores de tela. A página
  se atualiza sozinha, então cálculos concluídos, edições feitas em outra aba
  e mudanças nas premissas aparecem sem ação do usuário, sem nunca alterar o
  formulário. Uma versão mais nova da simulação oferece "Recarregar".
- Até a situação ficar atualizada, o painel mostra o último resultado bem
  sucedido, marcado como anterior às mudanças; uma simulação que nunca teve
  sucesso mostra só a situação.
- "Requer ação" mostra o motivo e como resolver: escolher outra curva ou
  oferta quando foi excluída ("Sem curva, escolha outra", "Sem oferta, escolha
  outra") ou corrigir o campo. A falta de cobertura, que só acontece antes do
  início de uma curva, nomeia os períodos sem valor ("A curva não tem valores
  entre 02/01/2023 e 29/12/2023") e leva à curva ("Ver curva <nome>").
  Depois que a oferta muda de índice, o motivo nomeia o índice novo ("A curva
  não é do SELIC, o índice da oferta. Escolha uma curva do SELIC e salve.";
  "A oferta é prefixada e não usa curva." numa oferta prefixada), e o
  formulário já troca a curva salva pela do índice novo quando há só uma, de
  modo que salvar resolve.
- "Falha técnica" explica que as novas tentativas automáticas se esgotaram e
  oferece "Tentar novamente", que pede o cálculo de novo.

### Prazo Restante

O painel de uma simulação salva começa pelo prazo, acima da situação e em
qualquer situação, pois depende só das datas salvas: "Vence em 14/10/2028 ·
faltam 1 ano, 11 meses e 28 dias", "Começa em 03/11/2026 · prazo de 2 anos"
antes da aplicação, "Vence hoje" e "Venceu em 14/10/2028" depois. As partes
zeradas são omitidas, e a divisão em anos, meses e dias segue a regra de meses
civis do PRD. Uma simulação não salva não mostra prazo.

### Resultados

- O valor líquido no vencimento vem com a rentabilidade líquida anual ao lado
  ("10,28% ao ano, já descontados os tributos"), respondendo às duas primeiras
  perguntas do usuário: quanto recebe e quão bom isso é. Depois vêm o bloco
  "Rentabilidade" e valor aplicado, saldo bruto, rendimento bruto, IOF, IR,
  total de tributos e valor líquido, com as datas, os dias úteis, o último fim
  da curva em toda simulação com curva ("A curva tem valores até 31/12/2028;
  depois, a taxa é mantida.") e o instante do cálculo no horário de São Paulo.
  "Evolução do saldo" fica recolhida.
- "Rentabilidade" é uma pequena tabela com as linhas "Ao ano", "Ao mês" e "No
  período" e as colunas "Líquida" (primeiro) e "Bruta", com duas casas
  decimais. Quando as duas são iguais, como em LCI e LCA, mostra uma só coluna,
  "Líquida e bruta", com a nota da isenção de IR em vez de repetir números.
- "Como a rentabilidade é calculada" (com um ícone de informação) abre uma
  explicação breve em palavras simples:
  - líquida é depois de IOF e IR;
  - "ao ano" distribui o rendimento do período em 252 dias úteis por ano,
    nomeando os dias úteis usados; por isso, numa oferta prefixada, a
    rentabilidade bruta anual coincide com a taxa, e no CDI ou na SELIC o
    rendimento segue os valores da curva vezes o percentual contratado;
  - "ao mês" é a taxa mensal constante equivalente, não o que cada mês civil
    rendeu, que aparece em "Evolução do saldo";
  - toda taxa supõe o dinheiro aplicado até o vencimento, pois o resgate
    antecipado ainda não é calculado.

  As taxas pertencem ao resultado: são marcadas como anteriores às mudanças
  junto com ele e escondidas quando nunca houve resultado bem sucedido.

- "Evolução do saldo" abre com um gráfico de área do saldo bruto no fim de cada
  mês (eixo em reais abreviado; o destaque mostra o saldo exato e o rendimento
  acumulado) e lista uma linha por mês (dias úteis, rendimento do mês,
  rendimento acumulado e saldo bruto no fim do mês). O botão de cada mês mostra
  ou esconde seus dias úteis logo abaixo.
- Tributos: as linhas de IOF e IR nomeiam a alíquota aplicada ("IOF · isento
  pelo prazo", "Imposto de renda · 22,5%" ou "Imposto de renda · isento" em
  LCI e LCA, cuja explicação trata da isenção sem tabela de faixas). "Como os
  tributos foram calculados" (com um ícone de informação) abre uma explicação
  breve: o prazo da aplicação e, para IOF e IR, uma frase com a regra, a conta
  com os valores do cálculo e a tabela com a faixa aplicada marcada como "seu
  caso" (não só por cor).

### Ações

- O cabeçalho de uma simulação salva oferece "Nova simulação" (um formulário em
  branco), "Duplicar" e "Excluir".
- "Duplicar" abre uma nova simulação com a mesma oferta, curva e investimento,
  para comparar lado a lado. "Excluir" pede confirmação, informa que a
  exclusão é definitiva e, quando a simulação está em planos, que "Ela sai de N
  planos". Alterações não salvas são confirmadas antes de sair.

### Planos

- Sob o título, a linha "Planos" leva a cada plano que contém a simulação ("e
  mais N" depois de 100; "nenhum" sem planos), com seus próprios estados de
  carregamento e nova tentativa.
- "Adicionar ao plano" abre um painel com os planos do dono por nome, 20 por
  página, cada um com "Adicionar". Planos que já contêm a simulação ("Já
  inclui esta simulação") e planos cheios ("Plano cheio: 50 simulações") ficam
  desabilitados com o motivo em texto. Uma adição por vez; o resultado, ou a
  falha com o nome do plano e a mensagem do sistema, é anunciado no painel, que
  continua aberto. Esse é o caminho permanente para adicionar uma simulação a
  um plano.
- Uma simulação criada a partir de "Nova simulação" de um plano, depois de
  salva e com sua página aberta, mostra o aviso "Simulação criada. Adicionar ao
  plano {nome}?" com "Adicionar ao plano". A ação a adiciona (repeti-la não
  muda nada) e transforma o aviso em "Adicionada ao plano {nome}" com "Ver
  plano", ou "Não foi possível adicionar ao plano {nome}" com a mensagem do
  sistema. Um plano inexistente, excluído ou cheio não mostra aviso, e nada do
  plano faz a simulação parecer não salva.
