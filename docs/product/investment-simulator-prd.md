# Simulador de Investimentos em Renda Fixa

PRD condensado para consulta sob demanda. Descreve produto e regras de negócio;
não define arquitetura de software.

O contexto de negócio e as regras das curvas estão detalhados em
[Curvas de Valores dos Índices](./index-value-curves.md).

## Visão

Simulador educacional para planejar e comparar investimentos brasileiros de
renda fixa. O MVP cobre CDB, LCI e LCA e permite manter ofertas, curvas de
índices, portfólios e simulações. Os resultados acompanham as premissas: quando
uma oferta ou uma curva muda, as simulações que a usam são recalculadas.

O produto não executa transações financeiras reais.

## Problema

Investidores iniciantes precisam estimar rendimento líquido considerando prazo,
tributos, índices e liquidez. Calculadoras existentes frequentemente não
permitem manter portfólios, comparar cenários ou ver os resultados se
atualizarem quando as premissas mudam.

## Usuário e Acesso

- Usuário pessoa física autenticado via Keycloak.
- Contas são provisionadas previamente por administradores.
- Autocadastro não faz parte do MVP.
- Cada usuário acessa somente seus próprios portfólios e simulações.
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

- Editar uma condição de oferta ou um cenário de curva recalcula todas as
  simulações que o usam. Não há cópia congelada das premissas.
- O recálculo é assíncrono. Uma simulação pode estar aguardando cálculo,
  calculando, atualizada, impedida por uma regra de negócio ou com falha
  técnica (ver [Cálculos de Simulação](#cálculos-de-simulação)). Esses estados
  fazem parte do produto e são sempre exibidos.
- Excluir é definitivo do ponto de vista do usuário: o item deixa de existir
  para ele, mesmo que o armazenamento mantenha um registro técnico.
- Resultados passados não são reproduzíveis. Cada simulação tem um único
  resultado atual; não há histórico de cálculos.
- A interface deixa claro, antes de salvar ou excluir, que a mudança afeta as
  simulações que usam o item, e quantas são.
- Quem quiser preservar uma condição ou um cenário antes de alterá-lo usa
  "Duplicar" e edita a cópia.

Cada condição de oferta e cada cenário de curva tem um número de revisão,
incrementado a cada alteração salva. A revisão identifica quais premissas um
resultado usou e revela quando ele ficou desatualizado. Cada alteração também
gera um evento com a revisão e o que mudou, base da auditoria.

## Escopo do MVP

### Ofertas

Uma oferta reúne um grupo e suas condições:

- **Oferta** (grupo): título (CDB, LCI ou LCA), emissor opcional e nome. Título
  e emissor não mudam depois da criação; são compartilhados por todas as
  condições do grupo.
- **Condição**: remuneração e taxa, data de vencimento e liquidez. Pode ter um
  nome; sem nome, é identificada pelos próprios termos. Cada condição é
  independente e editável por seu dono.

Comportamento:

- Criar, consultar, editar e excluir ofertas privadas e suas condições. O dono
  pode renomear uma oferta privada; excluí-la exclui suas condições.
- "Duplicar" uma condição cria outra condição no mesmo grupo, privada do
  usuário. Duplicar uma condição do sistema coloca a cópia privada dentro da
  oferta do sistema: o usuário vê ali as condições do sistema e as suas, e os
  demais usuários não veem a cópia.
- Criar uma oferta a partir do zero cria um novo grupo privado com sua
  primeira condição.
- A interface apresenta as condições agrupadas sob sua oferta.

### Curvas

Uma curva reúne um grupo e seus cenários:

- **Curva** (grupo): índice (CDI, SELIC efetiva ou IPCA), que determina a
  convenção dos valores, e nome. O índice não muda depois da criação.
- **Cenário**: nome, descrição opcional e intervalos com valores, como "Base",
  "Otimista" ou "Pessimista". Cada cenário é independente e editável por seu
  dono.

Grupos privados, duplicação, visibilidade e exclusão seguem as mesmas regras
das ofertas. Valores de usuários são informados manualmente; curvas do sistema
vêm da carga inicial e, futuramente, de processos de importação. A falta de
cobertura necessária impede o cálculo. As regras dos intervalos estão na
documentação de curvas.

### Portfólios

- Criar, consultar, renomear e excluir múltiplos portfólios.
- Nome e descrição identificam um portfólio.
- Um portfólio agrupa múltiplas simulações de títulos bancários.
- Comparar portfólios por valores agregados e rentabilidade média.
- O estado de um portfólio deriva do estado de suas simulações: em
  atualização enquanto alguma aguarda cálculo ou calcula, e com pendência
  enquanto alguma está impedida ou com falha. Os totais usam o último
  resultado bem sucedido de cada simulação.

### Simulações de Títulos Bancários

- Criar, consultar, editar e excluir simulações.
- Comparar duas ou mais simulações lado a lado.
- "Duplicar" uma simulação cria outra com as mesmas escolhas, para comparação.

Uma simulação sempre usa uma condição de oferta. Ela é composta por:

- a condição de oferta escolhida;
- o cenário de curva, quando a remuneração é indexada; ele deve ser do mesmo
  índice da remuneração;
- o valor inicial;
- a data de aplicação.

Todos esses itens são editáveis. Termos diferentes significam outra condição:
na tela da simulação, "Duplicar e ajustar" cria uma condição privada no mesmo
grupo a partir da condição escolhida, e "Digitar termos" cria uma oferta
privada com sua primeira condição. A nova oferta ou condição é criada junto com
a simulação: se a solicitação for rejeitada, nada é criado. Condições do
sistema não podem ser editadas, somente duplicadas.

Tipos de remuneração: prefixado, pós-fixado por CDI ou SELIC efetiva, ou
híbrido por IPCA. A data de resgate antecipado, quando permitida pela liquidez,
segue fora do recorte atual dos cálculos.

O calculador inicial suporta CDB, LCI e LCA prefixados, por percentual do CDI
ou por percentual da SELIC efetiva. IPCA permanece previsto no produto, mas seu
cálculo fica adiado até a definição do perfil contratual. No recorte atual, o
cálculo produz a trajetória bruta de todos os dias úteis até o vencimento, sem
recebimentos antecipados. IOF e IR aparecem somente no resumo do vencimento.

### Cálculos de Simulação

- Criar ou editar uma simulação valida a solicitação e a aceita ou rejeita
  imediatamente. Uma solicitação rejeitada não salva nada e informa o motivo
  no campo responsável. Uma solicitação aceita salva a simulação e agenda seu
  cálculo; o resultado chega de forma assíncrona.
- A validação imediata cobre o que depende apenas das entradas e das
  referências escolhidas: valor inicial positivo, dias úteis, prazo mínimo,
  compatibilidade entre remuneração e índice, e condição e cenário existentes
  e visíveis para o usuário.
- Alterar ou excluir uma condição ou um cenário, ou mudar a versão da
  metodologia de um título, agenda o recálculo de todas as simulações
  afetadas.
- Cada simulação tem um único resultado atual: o investimento usado, a versão
  da metodologia, as revisões da condição e do cenário usados, o instante do
  cálculo, o resumo no vencimento, a apuração dos tributos (prazo em dias
  corridos, base, alíquota e valor do IOF ou isenção, base, alíquota e valor do
  IR) e a trajetória diária bruta. Um novo cálculo bem sucedido substitui o
  anterior.
- O estado do cálculo de uma simulação é sempre um destes:

  | Estado             | Significado                                                                   | Quem age                                   |
  | ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------ |
  | Aguardando cálculo | As entradas mudaram e o cálculo está agendado.                                | Sistema                                    |
  | Calculando         | O cálculo está em execução.                                                   | Sistema                                    |
  | Atualizado         | O resultado corresponde às entradas, revisões e metodologia atuais.           | —                                          |
  | Requer ação        | Uma regra de negócio impede o cálculo; o motivo é exibido.                    | Usuário                                    |
  | Falha técnica      | O cálculo falhou por erro do sistema depois das novas tentativas automáticas. | Sistema; usuário pode pedir nova tentativa |

- "Requer ação" exibe o motivo: falta de cobertura do cenário (com os
  períodos descobertos), cenário excluído ("Sem curva, escolha outra"),
  condição excluída ("Sem oferta, escolha outra"), data que não é dia útil,
  prazo mínimo não atendido ou índice incompatível. Ele vale para as entradas
  atuais: quando o usuário ou o dono da premissa a corrige, a simulação volta a
  aguardar cálculo.
- Enquanto não está atualizada, a simulação exibe o último resultado bem
  sucedido, identificado como anterior às alterações, junto com seu estado.
  Uma simulação que nunca teve cálculo bem sucedido exibe somente o estado.
- Uma simulação cujo resultado não corresponde às revisões atuais de suas
  premissas, sem cálculo agendado ou em execução, é recalculada
  automaticamente pelo sistema. Nenhuma alteração fica sem cálculo por perda de
  uma notificação interna.
- A tela de resultado mostra a alíquota aplicada ao lado de cada tributo e, sob
  demanda, explica o cálculo de forma breve: a regra de cada tributo, a conta
  com os valores do cálculo e as tabelas de IOF e IR com a faixa aplicada
  destacada.
- Cada título tem sua própria versão da metodologia (`cdb-252-v1`,
  `lci-252-v1`, `lca-252-v1`), que muda sempre que fórmulas, convenções,
  tributação ou o calendário alterarem os valores calculados daquele título.
- Resultados de simulações excluídas deixam de ser consultáveis.

### Resultados

Por simulação:

- montante bruto;
- rendimento bruto;
- IR;
- IOF, quando aplicável;
- montante líquido;
- rentabilidade mensal, anualizada e total;
- prazo restante;
- data de vencimento;
- estado do cálculo.

Por portfólio:

- soma dos valores aplicáveis;
- rentabilidade média;
- comparação agregada entre portfólios;
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
  12 de outubro, 2, 15 e 20 de novembro e 25 de dezembro.
- Carnaval (segunda e terça-feira), Paixão de Cristo e Corpus Christi são
  derivados anualmente da data da Páscoa pelo computus gregoriano documentado
  no domínio compartilhado.
- A contagem exclui a data inicial e inclui a data final.
- O cálculo exige aplicação e vencimento em dias úteis, sem ajuste automático.
  Uma simulação com data de aplicação ou vencimento fora de dia útil é
  rejeitada ao ser salva. Uma condição de oferta pode ser salva com vencimento
  em qualquer data; as simulações que a usam passam a "Requer ação".
- Fechamentos exclusivos da B3, feriados estaduais ou municipais e alterações
  extraordinárias de calendário ficam fora do MVP.

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

### Híbrido por IPCA

Compor multiplicativamente o fator de atualização pelo IPCA e o fator da
parcela fixa. O perfil contratual de atualização, incluindo aniversário,
defasagem e proporcionalização, ainda precisa ser definido. O contexto de
mercado e suas implicações estão na documentação de curvas.

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

### Liquidez e Resgate

- Liquidez diária: permitir resgate antes do vencimento e calcular rendimento,
  IR e IOF usando a data efetiva de resgate.
- Liquidez no vencimento: não permitir resgate antecipado; calcular até o
  vencimento.

### Portfólio com Vencimentos Diferentes

A data final de análise é o vencimento mais distante do portfólio. Nessa data,
somar somente simulações ainda ativas, sem reinvestir simulações já vencidas.

Esta regra pode excluir do total simulações vencidas anteriormente e deve ser
validada antes da implementação.

## Requisitos Não Funcionais

- Persistir ofertas, curvas, portfólios, simulações e o resultado atual de
  cada simulação.
- Recalcular de forma assíncrona e confiável: toda alteração aceita leva ao
  recálculo das simulações afetadas, mesmo após falhas temporárias.
- Gerar um evento com a revisão e a alteração realizada a cada criação,
  edição ou exclusão de ofertas, condições, curvas e cenários. A consulta de
  auditoria a partir desses eventos fica adiada.
- Autenticar por token.
- Interface em português, responsiva e acessível.
- Permitir futura internacionalização.

## Fora do Escopo do MVP

- transações financeiras reais;
- autocadastro;
- reprodução de resultados passados e histórico de cálculos;
- consulta de auditoria das alterações;
- edição de ofertas e curvas do sistema por usuários;
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
- Importar índices de fontes como Banco Central, ANBIMA ou BrasilAPI para
  manter as curvas do sistema.
- Consultar a auditoria das alterações de ofertas e curvas.
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

## Pendências de Produto

- Definir o perfil contratual de atualização e a fórmula completa dos títulos
  híbridos por IPCA, conforme a documentação de curvas, incluindo os prazos
  mínimos de LCI e LCA indexadas a índice de preços.
- Validar regra de agregação para portfólios com vencimentos diferentes.
- Definir significado e cálculo da rentabilidade média do portfólio.
- Definir a rentabilidade mensal, anualizada e total da simulação (bruta ou
  líquida e a forma de anualização) e o prazo restante.
- Definir comportamento após vencimento e eventual resgate.
- Definir a interface de cadastro dos intervalos de um cenário.
