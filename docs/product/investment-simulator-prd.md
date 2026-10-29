# Simulador de Investimentos em Renda Fixa

PRD condensado para consulta sob demanda. Descreve produto e regras de negócio;
não define arquitetura de software.

O contexto de negócio e as regras das curvas estão detalhados em
[Curvas de Valores dos Índices](./index-value-curves.md).

Este documento descreve o produto pretendido, não o que já está implementado.
O estado atual da implementação está em [Current State](./current-state.md),
e as próximas entregas, em [planned/](./planned/).

## Visão

Simulador educacional para planejar e comparar investimentos brasileiros de
renda fixa. O MVP cobre CDB, LCI e LCA e permite manter ofertas, curvas de
índices, planos de investimento e simulações. Os resultados acompanham as premissas: quando
uma oferta ou uma curva muda, as simulações que a usam são recalculadas.

O produto não executa transações financeiras reais.

## Problema

Investidores iniciantes precisam estimar rendimento líquido considerando prazo,
tributos, índices e liquidez. Calculadoras existentes frequentemente não
permitem reunir investimentos em planos, comparar cenários ou ver os resultados se
atualizarem quando as premissas mudam.

## Usuário e Acesso

- Usuário pessoa física autenticado via Keycloak.
- Contas são provisionadas previamente por administradores.
- Autocadastro não faz parte do MVP.
- Cada usuário acessa somente seus próprios planos e simulações.
- Ofertas e curvas são privadas ou do sistema:
  - criadas por um usuário são visíveis somente para ele, que pode editá-las e
    excluí-las;
  - criadas pelo sistema (carga inicial ou processos automáticos) são visíveis
    para todos os usuários autenticados e não podem ser editadas nem excluídas
    por usuários.
- Uma simulação só pode usar ofertas e curvas visíveis para seu dono.

## Modelo de Atualização

Ofertas, curvas e simulações são deliberadamente editáveis, e as simulações
reagem às mudanças das ofertas e curvas que usam:

- Editar uma oferta ou uma curva recalcula todas as
  simulações que usam o item editado. Não há cópia congelada das premissas.
- O recálculo é assíncrono. Uma simulação pode estar calculando, atualizada,
  impedida por uma regra de negócio ou com falha técnica (ver
  [Cálculos de Simulação](#cálculos-de-simulação)). Esses estados fazem parte
  do produto e são sempre exibidos, junto com a causa do último recálculo.
- Excluir é definitivo do ponto de vista do usuário: o item deixa de existir
  para ele, mesmo que o armazenamento mantenha um registro técnico.
- Resultados passados não são reproduzíveis. Cada simulação tem um único
  resultado atual; não há histórico de cálculos.
- A interface deixa claro, antes de salvar ou excluir, que a mudança afeta as
  simulações que usam o item, e quantas são.
- Quem quiser preservar uma oferta ou uma curva antes de alterá-la usa
  "Duplicar" e edita a cópia.

Cada oferta e cada curva tem um número de revisão,
incrementado a cada alteração salva. A revisão identifica quais premissas um
resultado usou e revela quando ele ficou desatualizado. Cada alteração também
gera um evento que identifica o item alterado e leva ao recálculo das
simulações afetadas.

## Escopo do MVP

### Ofertas

Uma oferta tem título (CDB, LCI ou LCA), nome, emissor opcional, remuneração e
taxa, data de vencimento e liquidez. O título não muda depois da criação, pois
determina a metodologia e a tributação. Ofertas parecidas, como "CDB 110% do
CDI" e "CDB 120% do CDI" do mesmo emissor, são ofertas distintas, cada uma
independente e editável por seu dono.

- Criar, consultar, editar e excluir ofertas privadas.
- "Duplicar" uma oferta, inclusive do sistema, cria uma oferta privada do
  usuário com os mesmos termos, para ser editada sem afetar a original.
- Excluir uma oferta não afeta suas cópias.
- A interface apresenta as ofertas agrupadas por título e por origem (do
  sistema ou minhas). O agrupamento é apenas apresentação.

### Curvas

Uma curva tem índice (CDI, SELIC efetiva ou IPCA), que determina a convenção
dos valores, nome, descrição opcional e intervalos com valores. O índice não
muda depois da criação. Alternativas do mesmo índice, como "CDI base" e "CDI
otimista", são curvas distintas, cada uma independente e editável por seu
dono.

- Criar, consultar, editar e excluir curvas privadas.
- "Duplicar" uma curva, inclusive do sistema, cria uma curva privada do
  usuário com o mesmo conteúdo, para ser editada sem afetar a original.
- Excluir uma curva não afeta suas cópias.
- A interface apresenta as curvas agrupadas por índice e por origem (do
  sistema ou minhas). O agrupamento é apenas apresentação.

Valores de usuários são informados manualmente. As curvas do sistema são as
de CDI e SELIC efetiva, mantidas por um processo automático que importa, em
uma frequência definida, os valores publicados pelo Banco Central. O último intervalo de uma curva pode não ter
fim: seu valor é mantido em diante, e a interface sempre o identifica. As
curvas importadas mantêm a última taxa publicada, o que permite simular
ofertas que ainda não venceram. A falta de cobertura necessária impede o
cálculo. As regras dos intervalos, da taxa mantida e da importação estão na
documentação de curvas.

### Planos de Investimento

Decisão de 2026-10-27.

Um plano de investimento reúne as simulações em que o usuário investiria
junto, como a reserva de emergência ou a aposentadoria. Alternativas entre si
não formam um plano: comparam-se na
[Comparação de Simulações](#comparação-de-simulações), já que somá-las
contaria o mesmo dinheiro duas vezes.

- Criar, consultar, editar (nome e descrição) e excluir múltiplos planos.
- Nome e descrição identificam um plano; o nome é obrigatório.
- Um plano reúne até 50 simulações do próprio usuário. Uma simulação pode
  estar em vários planos. Adicionar uma simulação que já está no plano, ou
  remover uma que não está, não muda nada.
- Excluir um plano não exclui suas simulações.
- Uma simulação excluída sai dos seus planos e libera a vaga.
- O estado de um plano deriva das suas simulações e não é armazenado. Conta
  quantas estão:
  - em atualização: aguardando cálculo;
  - com pendência: impedidas ou com falha técnica;
  - com resultado desatualizado: com o último resultado anterior a uma
    mudança de metodologia ou a uma oferta ou curva alterada, cujo
    recálculo ainda não chegou ou não pôde ser agendado. Fica separado de
    "em atualização" porque, após uma mudança de metodologia ou um
    agendamento que falhou, nenhum recálculo virá sozinho.

  Sem nenhuma delas, os resultados do plano estão atualizados.

- Mostrar os totais do plano, o cronograma de vencimentos e a liquidez (ver
  [Totais do Plano](#totais-do-plano)). O plano não tem rentabilidade
  própria e não é comparado com outros planos: decidir qual plano é melhor
  está fora do escopo.

### Simulações de Títulos Bancários

- Criar, consultar, editar e excluir simulações.
- Comparar de duas a seis simulações lado a lado (ver
  [Comparação de Simulações](#comparação-de-simulações)).
- "Duplicar" uma simulação cria outra com as mesmas escolhas, para comparação.

Uma simulação sempre usa uma oferta. Ela é composta por:

- a oferta escolhida;
- a curva, quando a remuneração é indexada; ela deve ser do mesmo índice da
  remuneração;
- o valor inicial;
- a data de aplicação.

Todos esses itens são editáveis. Termos diferentes significam outra oferta:
na tela da simulação, "Duplicar e ajustar" cria uma oferta privada a partir da
oferta escolhida, e "Digitar termos" cria uma oferta privada com os termos
digitados. A nova oferta é salva antes da simulação: se a simulação for
rejeitada, a oferta continua salva em Ofertas e escolhida na simulação.
Ofertas do sistema não podem ser editadas, somente
duplicadas.

Tipos de remuneração: prefixado ou pós-fixado por CDI ou SELIC efetiva. O
híbrido por IPCA e o resgate antecipado ficam fora da primeira versão (ver
[Evolução Futura](#evolução-futura)).

O calculador suporta CDB, LCI e LCA prefixados, por percentual do CDI ou por
percentual da SELIC efetiva. O cálculo produz a trajetória bruta de todos os
dias úteis até o vencimento, sem recebimentos antecipados. IOF e IR aparecem somente no resumo do vencimento.

### Cálculos de Simulação

- Criar ou editar uma simulação valida a solicitação e a aceita ou rejeita
  imediatamente. Uma solicitação rejeitada não salva nada e informa o motivo
  no campo responsável. Uma solicitação aceita salva a simulação e agenda seu
  cálculo; o resultado chega de forma assíncrona.
- A validação imediata cobre o que depende apenas das entradas e das
  referências escolhidas: valor inicial positivo, dias úteis, prazo mínimo,
  compatibilidade entre remuneração e índice, e oferta e curva existentes e
  visíveis para o usuário.
- Alterar ou excluir uma oferta ou uma curva agenda o recálculo de todas as
  simulações afetadas. Até o novo resultado chegar, em poucos segundos, elas
  aparecem como desatualizadas, não como calculando. Mudar a versão da
  metodologia de um título não agenda
  recálculo: o resultado aparece como desatualizado até a simulação ser salva
  de novo.
- Cada simulação tem um único resultado atual: o investimento usado, a
  impressão das entradas de que foi calculado (revisões da simulação, da
  oferta e da curva e versão da metodologia), o instante do
  cálculo, o resumo no vencimento, a apuração dos tributos (prazo em dias
  corridos, base, alíquota e valor do IOF ou isenção, base, alíquota e valor do
  IR), a rentabilidade (ver
  [Rentabilidade e Prazo Restante](#rentabilidade-e-prazo-restante)) e a
  trajetória diária bruta. Um novo cálculo bem sucedido substitui o
  anterior.
- O estado do cálculo de uma simulação é sempre um destes:

  | Estado        | Significado                                                                   | Quem age                                   |
  | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
  | Calculando    | As entradas mudaram; o cálculo está agendado ou em execução.                  | Sistema                                    |
  | Atualizado    | O resultado corresponde às entradas, revisões e metodologia atuais.           | —                                          |
  | Requer ação   | Uma regra de negócio impede o cálculo; o motivo é exibido.                    | Usuário                                    |
  | Falha técnica | O cálculo falhou por erro do sistema depois das novas tentativas automáticas. | Sistema; usuário pode pedir nova tentativa |

- Cada estado informa sua causa: a criação da simulação, sua edição ou o
  pedido de nova tentativa. A causa acompanha o
  resultado do cálculo: "Requer ação" exibe o motivo e também a alteração
  que levou a ele. Somente o estado atual é mantido; não há histórico de
  estados.

- "Requer ação" exibe o motivo: falta de cobertura da curva (com os
  períodos descobertos), curva excluída ("Sem curva, escolha outra"),
  oferta excluída ("Sem oferta, escolha outra"), data que não é dia útil,
  prazo mínimo não atendido ou índice incompatível. Exceto a falta de cobertura,
  esses motivos também rejeitam a solicitação ao salvar; aparecem aqui quando
  uma oferta ou uma curva muda ou é excluída depois de a simulação ter sido
  salva. "Requer ação" vale para
  as entradas atuais: quando o usuário ou o dono da premissa a corrige, a
  simulação volta a calcular.
- Enquanto não está atualizada, a simulação exibe o último resultado bem
  sucedido, identificado como anterior às alterações, junto com seu estado.
  Uma simulação que nunca teve cálculo bem sucedido exibe somente o estado.
- Toda alteração aceita agenda o cálculo junto com a própria alteração, e o
  sistema repete automaticamente um cálculo interrompido ou que falhou por
  erro temporário. Nenhuma alteração fica sem cálculo por perda de uma
  notificação interna.
- A tela de resultado mostra a alíquota aplicada ao lado de cada tributo e, sob
  demanda, explica o cálculo de forma breve: a regra de cada tributo, a conta
  com os valores do cálculo e as tabelas de IOF e IR com a faixa aplicada
  destacada.
- Cada título tem sua própria versão da metodologia (`cdb-252-v1`,
  `lci-252-v1`, `lca-252-v1`), interna e nunca exibida, que muda sempre que fórmulas, convenções,
  tributação, o calendário ou a definição da rentabilidade alterarem os
  valores calculados daquele título.
- Resultados de simulações excluídas deixam de ser consultáveis.

### Resultados

Por simulação:

- montante bruto;
- rendimento bruto;
- IR;
- IOF, quando aplicável;
- montante líquido;
- rentabilidade líquida e bruta: ao ano, ao mês e no período;
- prazo restante;
- data de vencimento;
- estado do cálculo.

Por plano de investimento:

- valor aplicado, IOF, IR, montante líquido e rendimento líquido somados;
- período, da primeira aplicação ao último vencimento;
- cronograma de vencimentos;
- valor aplicado por liquidez;
- estado derivado das simulações.

No MVP, apresentar resultados em tabelas simples; a evolução do saldo de uma
simulação também tem um gráfico. Os demais gráficos e a exportação para
PDF/CSV ficam fora do escopo.

## Regras de Cálculo

### Convenções

- Capitalização usa 252 dias úteis por ano.
- Cálculos monetários usam a precisão padrão do `decimal.js` e não aplicam
  arredondamento de negócio em etapas intermediárias nem no resultado final.
- Valores persistidos e retornados preservam a precisão calculada. O frontend
  arredonda somente a representação exibida, de acordo com o formato escolhido,
  sem alterar o valor subjacente.
- Instantes exatos usam UTC. A interface os apresenta no fuso
  `America/Sao_Paulo`.
- Datas civis, como aplicação e vencimento, não possuem fuso horário e são
  apresentadas no mesmo dia de calendário informado pelo usuário.
- O rendimento corresponde ao montante bruto menos o valor inicial.
- O prazo tributário usa dias corridos entre a data de aplicação e a data
  efetiva de resgate ou vencimento. A data de aplicação não é contada e a data
  final é contada.
- O IOF incide somente sobre o rendimento positivo.
- O IR incide somente sobre o rendimento positivo já reduzido pelo IOF, quando
  houver.
- O montante líquido corresponde ao montante bruto menos IR e IOF.

### LCI e LCA

- Rendem com as mesmas fórmulas e convenções do CDB.
- São isentas de IR para pessoa física
  ([art. 3º, II, da Lei nº 11.033/2004](https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l11.033.htm)).
  O IOF segue a mesma tabela, mas o prazo mínimo o torna sempre zero.
- O vencimento deve ser de ao menos 9 meses após a aplicação, prazo mínimo do
  CMN para LCI e LCA não atualizadas por índice de preços. A regra vigente é
  aplicada a qualquer data de aplicação, sem reproduzir os prazos anteriores
  (90 dias até fevereiro de 2024; 12 meses para LCI entre fevereiro e agosto de
  2024). Títulos indexados ao IPCA, com prazos maiores, ficam para quando o IPCA
  for calculável.
- Somando um mês civil, o dia é mantido ou limitado ao último dia do mês:
  aplicação em 31/05 exige vencimento a partir de 28/02 (29/02 em ano
  bissexto).

### Calendário de Dias Úteis

- Um dia útil exclui sábados, domingos e os feriados nacionais usados pelo
  calendário financeiro da ANBIMA.
- Os feriados fixos são 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro,
  12 de outubro, 2, 15 e 20 de novembro e 25 de dezembro. Um feriado só vale
  a partir do ano em que foi instituído: 12 de outubro desde 1980 (Lei
  6.802/1980) e 20 de novembro desde 2024 (Lei 14.759/2023). As origens dos
  demais não foram pesquisadas, e eles valem em todos os anos.
- Carnaval (segunda e terça-feira), Paixão de Cristo e Corpus Christi são
  derivados anualmente da data da Páscoa pelo computus gregoriano documentado
  no domínio compartilhado.
- A contagem exclui a data inicial e inclui a data final.
- O cálculo exige aplicação e vencimento em dias úteis, sem ajuste automático.
  Uma simulação com data de aplicação ou vencimento fora de dia útil é
  rejeitada ao ser salva. Uma oferta pode ser salva com vencimento
  em qualquer data; as simulações que a usam passam a "Requer ação".
- Fechamentos exclusivos da B3, feriados estaduais ou municipais e alterações
  extraordinárias de calendário ficam fora do MVP.

### Anos Aceitos na Interface

Decisão de 2026-10-14: a interface web aceita datas (aplicação, vencimento de
oferta, intervalos de curva) entre 1º de janeiro de AA − 100 e 31 de dezembro
de AA + 100, sendo AA o ano corrente, porque seus calendários e verificações
de data não alcançam todos os anos. É um limite da interface: a API aceita
qualquer data. A interface carrega o calendário de dias úteis exatamente
desses anos.

### Prefixado

Usar juros compostos:

```text
montante_bruto = valor_inicial * (1 + taxa_do_periodo) ^ periodos
```

Converter a taxa anual para a periodicidade usada no cálculo.

### Pós-Fixado por CDI

Converter o CDI anual para a taxa diária equivalente e então aplicar o
percentual contratado sobre essa taxa diária:

```text
taxa_diaria_CDI = (1 + CDI_anual) ^ (1 / 252) - 1
fator_diario_aplicacao = 1 + taxa_diaria_CDI * percentual_do_CDI
saldo_bruto = saldo_bruto_anterior * fator_diario_aplicacao
```

As taxas e o percentual usam valores decimais: 12% equivale a 0,12 e 105% do
CDI equivale a 1,05. Usar a taxa de referência de cada período e acumular os
fatores diários. A taxa da data inicial de cada intervalo útil remunera até
o próximo dia útil; o saldo é apresentado nessa data final. As referências
incluem a aplicação e excluem o vencimento.

Referência: [metodologia de cálculo acumulado do DI — B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-calcudo-acumulado-de-di/).

### Pós-Fixado por SELIC Efetiva

Usar a curva de SELIC efetiva em taxa anual base 252, convertendo a taxa anual
para a equivalente diária antes de aplicar o percentual contratado:

```text
taxa_diaria_SELIC = (1 + SELIC_anual) ^ (1 / 252) - 1
fator_diario_aplicacao = 1 + taxa_diaria_SELIC * percentual_da_SELIC
saldo_bruto = saldo_bruto_anterior * fator_diario_aplicacao
```

Usar a mesma convenção de datas do CDI. A remuneração exige uma curva de SELIC;
uma curva de CDI não pode substituí-la. Não há conversão implícita da meta SELIC.

### Imposto de Renda

Para CDB, aplicar automaticamente a alíquota regressiva conforme o prazo
efetivo em dias corridos (LCI e LCA são isentas):

| Prazo efetivo     | Alíquota |
| ----------------- | -------: |
| até 180 dias      |    22,5% |
| 181 a 360 dias    |      20% |
| 361 a 720 dias    |    17,5% |
| acima de 720 dias |      15% |

A base de cálculo é o rendimento positivo reduzido pelo IOF:

```text
base_do_IR = max(rendimento_bruto - IOF, 0)
IR = base_do_IR * aliquota_do_IR
```

Referência: [art. 46 da Instrução Normativa RFB nº 1.585/2015](https://normas.receita.fazenda.gov.br/sijut2consulta/consulta/normas.fazenda.gov.br/sijut2consulta/link.action?idAto=67494&visao=original).

### IOF

- Aplicar a tabela regressiva sobre o rendimento positivo quando o prazo
  efetivo for inferior a 30 dias corridos.
- No 30º dia e nos posteriores, o IOF é zero.

| Dia corrido | Limite do rendimento | Dia corrido | Limite do rendimento |
| ----------: | -------------------: | ----------: | -------------------: |
|           1 |                  96% |          16 |                  46% |
|           2 |                  93% |          17 |                  43% |
|           3 |                  90% |          18 |                  40% |
|           4 |                  86% |          19 |                  36% |
|           5 |                  83% |          20 |                  33% |
|           6 |                  80% |          21 |                  30% |
|           7 |                  76% |          22 |                  26% |
|           8 |                  73% |          23 |                  23% |
|           9 |                  70% |          24 |                  20% |
|          10 |                  66% |          25 |                  16% |
|          11 |                  63% |          26 |                  13% |
|          12 |                  60% |          27 |                  10% |
|          13 |                  56% |          28 |                   6% |
|          14 |                  53% |          29 |                   3% |
|          15 |                  50% |          30 |                   0% |

```text
IOF = rendimento_bruto * percentual_do_IOF
```

Referência: [art. 32 e Anexo do Decreto nº 6.306/2007](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306compilado.htm).

### Ordem de Aplicação dos Tributos

1. Calcular o rendimento bruto até a data efetiva de resgate ou vencimento.
2. Calcular e descontar o IOF, quando aplicável.
3. Calcular o IR sobre o rendimento restante depois do IOF.

Exemplo: para R$ 100 de rendimento bruto no 10º dia corrido, o IOF é R$ 66.
O IR de 22,5% incide sobre os R$ 34 restantes e corresponde a R$ 7,65. O
rendimento líquido é R$ 26,35.

### Rentabilidade e Prazo Restante

Decisão de 2026-10-16.

A rentabilidade é calculada em duas versões: líquida, depois do IOF e do IR,
e bruta, antes dos tributos. A líquida é a principal, pois é a única que
compara de forma justa um CDB com uma LCI ou LCA isenta; a bruta corresponde
à taxa anunciada pela oferta. Cada versão tem três medidas, derivadas do
resultado do cálculo:

```text
rentabilidade_no_periodo = montante / valor_inicial - 1
rentabilidade_ao_ano     = (1 + rentabilidade_no_periodo) ^ (252 / dias_uteis) - 1
rentabilidade_ao_mes     = (1 + rentabilidade_ao_ano) ^ (1 / 12) - 1
```

- `montante` é o montante líquido ou o bruto, conforme a versão.
- `dias_uteis` é a contagem de dias úteis do cálculo, entre a aplicação
  (excluída) e o vencimento (incluído).
- A anualização usa 252 dias úteis, a mesma convenção da capitalização: um
  prefixado de 12% ao ano tem rentabilidade bruta de exatamente 12% ao ano.
- A rentabilidade ao mês é a taxa mensal equivalente, constante, e não o
  rendimento de cada mês civil. Equivale a usar 21 dias úteis por mês.
- Exemplo: CDB prefixado de 12% ao ano por 504 dias úteis e IR de 15% rende
  25,44% bruto e 21,62% líquido no período, ou 12,00% e 10,28% ao ano.
- A rentabilidade pertence ao resultado: é calculada com ele e acompanha o
  último resultado bem sucedido. Sua introdução não altera a versão da
  metodologia, pois nenhum valor existente muda; uma mudança futura na sua
  definição muda a versão, para que os resultados anteriores apareçam como
  desatualizados.
- A rentabilidade supõe que o investimento é mantido até o vencimento, pois o
  resgate antecipado ainda não é calculado.
- Rentabilidades preservam a precisão calculada; a interface as exibe com duas
  casas decimais.

O prazo restante conta os dias corridos até o vencimento a partir de hoje, a
data em UTC:

- antes da data de aplicação, conta a partir da aplicação, de modo que nunca
  supera o prazo total;
- no dia do vencimento é zero, e depois dele a simulação aparece como vencida,
  sem prazo restante. O que acontece com o investimento após o vencimento
  fica fora da primeira versão;
- depende somente das datas da simulação atual (aplicação e vencimento da
  oferta), não do resultado, e por isso aparece em qualquer estado do
  cálculo. Sem oferta, não há prazo restante;
- é apresentado em anos, meses e dias contados com a regra de soma de meses
  civis usada no prazo mínimo de LCI e LCA: anos inteiros, depois meses
  inteiros, depois os dias restantes. Somar um mês mantém o dia ou o limita ao
  último dia do mês, de modo que de 31/01 a 28/02 há 1 mês. O prazo total
  exibido antes da aplicação usa a mesma regra.

### Comparação de Simulações

Decisão de 2026-10-16.

A comparação responde qual simulação rende mais e por quê:

- reúne de duas a seis simulações do usuário, escolhidas na lista. Não é
  salva: existe apenas no endereço da tela. Reúne alternativas; o que o
  usuário investiria junto é um
  [plano de investimento](#planos-de-investimento);
- ordena pela rentabilidade líquida ao ano do último resultado bem sucedido
  de cada simulação, a única medida justa entre prazos diferentes e entre
  títulos tributados e isentos. Empates dividem a posição, e todas as
  empatadas são as melhores;
- mostra a diferença de cada simulação para a melhor em pontos percentuais
  ao ano. Quando ao menos duas simulações com resultado têm o mesmo valor
  inicial, a mesma data de aplicação e o mesmo vencimento, os montantes também
  se comparam diretamente, e a diferença aparece também em reais. Nesse caso a
  melhor pela rentabilidade é também a de maior montante líquido;
- uma simulação calculando, que requer ação, com falha técnica ou
  desatualizada entra na ordem pelo seu último resultado, identificado como
  anterior às alterações, e a comparação aparece como provisória. Uma
  simulação sem resultado fica fora da ordem;
- mostra lado a lado as premissas (título, emissor, remuneração, curva,
  liquidez, valor inicial, datas e prazo restante), o resultado líquido, os
  tributos e o resultado bruto de cada simulação, com o estado do cálculo.

### Liquidez e Resgate

A liquidez (diária ou no vencimento) é um termo da oferta, exibido nas telas e
usado nos totais dos planos. O cálculo vai sempre até o vencimento, mesmo com
liquidez diária; o resgate antecipado fica fora da primeira versão (ver
[Evolução Futura](#evolução-futura)).

### Totais do Plano

Decisão de 2026-10-28.

Os totais de um plano respondem quanto o usuário aplica, quanto recebe e
quando:

- Usam o último resultado bem sucedido de cada simulação, atualizado ou não.
  Uma simulação sem resultado fica fora dos totais, e o plano informa quantas
  ficaram. Enquanto o estado do plano não está atualizado, os totais aparecem
  como provisórios.
- Somam o valor aplicado, o IOF, o IR, o montante líquido e o rendimento
  líquido de cada simulação no seu próprio vencimento, sem reinvestimento
  entre um vencimento e outro. Como os valores são de datas diferentes, o
  plano mostra o seu período: da primeira aplicação ao último vencimento.
- O cronograma de vencimentos agrupa as simulações pelo mês de vencimento,
  já que poucas vencem no mesmo dia: cada mês com algum vencimento mostra
  quantas simulações vencem, o montante líquido recebido e o acumulado até
  ele, e indica quantas já venceram (as de vencimento até hoje).
- A liquidez divide o valor aplicado entre liquidez diária e somente no
  vencimento, em reais e em percentual. O resgate antecipado ainda não é
  calculado: a parte com liquidez diária diz quanto pode ser resgatado, não
  quanto um resgate renderia.
- O plano não tem uma rentabilidade própria, como uma média ou uma taxa
  interna de retorno: nenhuma delas tem um significado que o usuário
  verifique, e cada simulação já mostra a sua. Planos não são comparados nem
  ordenados entre si; alternativas se comparam na
  [Comparação de Simulações](#comparação-de-simulações).

## Requisitos Não Funcionais

- Persistir ofertas, curvas, planos de investimento, simulações e o resultado atual de
  cada simulação.
- Recalcular de forma assíncrona e confiável: toda alteração aceita leva ao
  recálculo das simulações afetadas, mesmo após falhas temporárias.
- Gerar um evento a cada criação, edição ou exclusão de ofertas e curvas.
- Autenticar por token.
- Interface em português, responsiva e acessível.
- Permitir futura internacionalização.

## Fora do Escopo do MVP

- transações financeiras reais;
- autocadastro;
- reprodução de resultados passados e histórico de cálculos;
- registro e consulta de auditoria das alterações;
- saldo hoje: o valor de uma simulação antes do vencimento;
- comparações salvas;
- títulos híbridos por IPCA;
- resgate antecipado e o que acontece com o investimento após o vencimento;
- edição de ofertas e curvas do sistema por usuários;
- indicar qual plano de investimento é melhor ou comparar planos entre si;
- gráficos além da evolução do saldo;
- exportação PDF/CSV;
- aportes recorrentes e reinvestimento automático;
- rentabilidade real ajustada pela inflação;
- análise de risco ou rating de emissores;
- alertas sobre limite do FGC;
- outros títulos além de CDB, LCI e LCA;
- multi-moeda.

## Evolução Futura

- Notificar o usuário em tempo real quando resultados de suas simulações mudam,
  por exemplo quando novos valores chegam a uma curva do sistema.
- Importar outros índices e fontes, como ANBIMA ou BrasilAPI, para manter as
  curvas do sistema.
- Calcular títulos híbridos por IPCA, definindo antes o perfil contratual de
  atualização (aniversário, defasagem, proporcionalização e extremidades), a
  fórmula completa e os prazos mínimos de LCI e LCA indexadas a índice de
  preços. A pesquisa de mercado está em
  [IPCA: Atualização e Parcela Fixa](./index-value-curves.md#ipca-atualização-e-parcela-fixa).
- Calcular o resgate antecipado das ofertas com liquidez diária, com
  rendimento, IR e IOF na data efetiva do resgate, e definir o que acontece
  com o investimento após o vencimento.
- Suportar Tesouro Direto, debêntures, CRI e CRA.
- Comparar rendimento líquido entre diferentes tipos de título.
- Exibir rentabilidade real descontada pelo IPCA.
- Simular aportes regulares, reinvestimentos e taxas variáveis.
- Adicionar outros gráficos, relatórios e exportações.
- Adicionar análise de risco, rating, FGC e suporte multi-moeda.

## Regras Futuras Relevantes

- FGC cobre determinados títulos em até R$ 250.000 por CPF e instituição.
- LCI/LCA são cobertas pelo FGC.
- Tesouro Direto não é coberto pelo FGC.
- Debêntures e CRI/CRA não são cobertos pelo FGC.
