# Curvas de Valores dos Índices

## Objetivo e Status

Esta especificação reúne o contexto de negócio das curvas usadas pelo
[Simulador de Investimentos em Renda Fixa](./investment-simulator-prd.md).
Descreve significado, escolhas do usuário, regras, exemplos e pendências de
produto. Não define classes, APIs, tabelas, serviços ou estrutura de código.

As decisões confirmadas aqui refinam o PRD. Recomendações e pendências estão
identificadas separadamente e não devem ser tratadas como requisitos aprovados.
As referências de mercado fundamentam os cálculos; elas não tornam todas as
modalidades de títulos citadas parte do escopo do produto.

## Problema de Negócio

Uma simulação de investimento precisa de uma trajetória de índices para
calcular seu rendimento durante o tempo. Um único CDI ou IPCA informado para todo o
prazo não representa mudanças de cenário nem permite comparar diferentes
expectativas para o mesmo investimento.

A curva reúne essas trajetórias. Cada trajetória é um cenário, como uma
trajetória base e alternativas otimista e pessimista do mesmo índice. Esses
nomes identificam premissas escolhidas para o experimento; não representam
garantia de retorno ou classificação obrigatória dos cenários.

O usuário ajusta seus cenários ao longo do tempo, e o sistema mantém cenários
públicos atualizados. As simulações que usam um cenário acompanham essas
mudanças. O produto também precisa reconhecer quando os dados escolhidos não
cobrem o período necessário, em vez de produzir silenciosamente um resultado
incompleto.

## Uso Pretendido

O usuário:

1. Seleciona uma condição de oferta.
2. Informa a data de aplicação, que pode estar no passado.
3. Informa o valor inicial.
4. Seleciona um cenário de uma curva do índice necessário à remuneração.
5. Salva a simulação e acompanha seu resultado, calculado de forma assíncrona,
   com os valores de todos os dias úteis.

Quando o cenário muda, a simulação é recalculada e o resultado passa a refletir
os novos valores.

O horizonte deste recorte termina no vencimento da oferta. Resgate antecipado
e recebimentos antes do vencimento estão fora deste escopo, mesmo quando a
oferta possui liquidez diária.

O investimento prefixado não necessita de uma curva de índice para remunerar
o capital: sua taxa vem da oferta. O cenário é necessário quando o cálculo
depende de um índice. O conjunto exato de modalidades inicialmente suportadas
continua subordinado ao PRD e às pendências deste documento.

A escolha de um cenário de SELIC não substitui automaticamente um cenário de
CDI exigido pela oferta. A disponibilidade de diferentes índices não significa
que eles possam ser trocados sem uma regra de negócio específica.

## Vocabulário

| Conceito          | Significado no simulador                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Índice            | Referencial econômico identificado, como CDI, SELIC efetiva ou IPCA.                             |
| Curva             | Grupo de cenários de um único índice, com nome e dono.                                           |
| Cenário           | Trajetória de valores de uma curva, com nome, descrição opcional e intervalos.                   |
| Convenção         | Significado dos valores: unidade, periodicidade e base de capitalização, quando aplicável.       |
| Intervalo         | Período declarado ao qual um valor se refere.                                                    |
| Competência       | Período econômico medido por um índice, como um mês de inflação.                                 |
| Cobertura         | Disponibilidade dos valores necessários para um cálculo específico.                              |
| Revisão           | Número do cenário incrementado a cada alteração salva.                                           |
| Oferta            | Grupo de condições de um título e emissor.                                                       |
| Condição          | Remuneração, taxa, vencimento e liquidez de uma oferta.                                          |
| Simulação         | Hipótese de investir um valor em uma data sob uma condição de oferta e, se indexada, um cenário. |
| Resultado         | Cálculo atual da simulação, com as revisões das premissas que usou.                              |
| Rendimento diário | Diferença entre o saldo bruto calculado e o saldo bruto anterior.                                |

Um cenário é uma trajetória de premissas do simulador. Não se presume que ele
seja uma curva de juros a termo extraída de preços de mercado. Nas seções
sobre intervalos, convenções e cobertura, os valores e intervalos de "uma
curva" são os de um de seus cenários.

## Decisões Confirmadas

| Decisão                      | Regra                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Representação por intervalos | Os valores possuem início e fim explícitos.                                                              |
| Capacidade diária            | Início igual ao fim representa um intervalo de um único dia, quando compatível com a convenção.          |
| Convenção única              | Todos os cenários de uma curva utilizam a convenção do seu índice.                                       |
| Ausência de cobertura        | A falta de um valor necessário impede o cálculo.                                                         |
| Curva e cenários             | A curva fixa o índice; cada cenário é independente e editável.                                           |
| Edição                       | Editar um cenário altera o próprio cenário, incrementa sua revisão e recalcula as simulações que o usam. |
| Visibilidade                 | Cenários de usuários são privados; cenários do sistema são públicos e somente leitura para usuários.     |
| Duplicação                   | Duplicar cria um cenário privado na mesma curva, inclusive em curvas do sistema.                         |
| Exclusão                     | Excluir é definitivo para o usuário; simulações que usavam o cenário passam a "Requer ação".             |
| Limites dos intervalos       | Início e fim inclusivos, sem sobreposição entre trechos.                                                 |
| Cadastro incompleto          | Lacunas são permitidas, mas o cenário precisa ter pelo menos um intervalo.                               |
| Convenções iniciais          | CDI e SELIC efetiva em taxa anual base 252; IPCA em variação mensal.                                     |
| Valores                      | Juros não negativos; inflação maior que −100%; zero é permitido.                                         |
| Resultado diário             | O cálculo fornece rendimento e acumulação brutos para todos os dias úteis do período.                    |
| Tributos                     | IOF e IR são apurados e apresentados somente no resumo do vencimento.                                    |
| Horizonte atual              | O cálculo não considera saída ou recebimento antecipado.                                                 |

As regras exatas do CDI e do híbrido foram objeto de pesquisa de mercado
solicitada durante a definição do produto. O CDI e as pendências do IPCA estão
detalhados adiante.

## Curva, Cenários e Responsabilidades

A curva possui identidade própria, independente de ofertas e simulações. Ela
fixa o índice e, por ele, a convenção que interpreta os valores de todos os
seus cenários. Cada cenário tem identidade própria dentro da curva.

| Curva (grupo)                           | Cenário                                |
| --------------------------------------- | -------------------------------------- |
| Identidade e nome.                      | Identidade, nome e descrição opcional. |
| Índice e convenção, fixos após criação. | Intervalos e valores editáveis.        |
| Dono: um usuário ou o sistema.          | Dono e revisão.                        |

Os cenários de uma curva compartilham tudo o que não é editável e são
apresentados agrupados sob ela. O nome de uma curva privada pode ser alterado
por seu dono; o índice nunca muda. Mudar o índice significa criar outra curva.

A curva e o cenário não possuem o valor investido, o percentual do CDI
contratado, a taxa fixa da oferta, o vencimento do investimento ou suas regras
tributárias. Um mesmo cenário pode alimentar várias simulações com resultados
diferentes.

## Intervalos e Significado dos Valores

### Taxas de Juros

Para taxas de juros, os limites do intervalo são inclusivos e o valor é
constante nas referências cobertas. Intervalos não podem se sobrepor, mesmo
quando os valores forem iguais.

Exemplo fictício de CDI em taxa anual efetiva, base 252:

| Início     | Fim        | Taxa anual |
| ---------- | ---------- | ---------: |
| 01/10/2026 | 31/10/2026 |        12% |
| 01/11/2026 | 30/11/2026 |      11,5% |
| 01/12/2026 | 31/12/2026 |        11% |

O primeiro trecho declara uma taxa anual de 12% para cada data necessária
abrangida em outubro. Ele não declara um rendimento de 12% durante outubro.

Uma trajetória diária pode utilizar um intervalo de um dia por observação.
Essa capacidade prepara o domínio para futuros históricos ou carregamentos
diários; não exige implementar importação automática agora.

### Variações de Inflação

Para o IPCA, são guardadas variações mensais por competência. O
IPCA é um índice de periodicidade mensal, conforme o
[IBGE](https://www.ibge.gov.br/indicadores/indices-precos/ipca.html).

Exemplo fictício:

| Competência   | Variação mensal |
| ------------- | --------------: |
| Outubro/2026  |            0,4% |
| Novembro/2026 |            0,3% |

O valor representa a variação do mês inteiro. Não deve ser aplicado
integralmente em cada dia. A competência também não determina, sozinha, as
datas em que aquela inflação corrige uma aplicação.

Os intervalos mensais começam no primeiro dia de um mês e terminam no último
dia de um mês. Um trecho de outubro a dezembro com valor de 0,4% declara essa
variação em cada uma das três competências, não uma variação conjunta de 0,4%.
Consultar qualquer dia de outubro identifica a competência de outubro e
retorna seu valor mensal; isso não transforma o valor em inflação diária.

A capacidade de representar intervalos de um dia não autoriza atribuir
significado diário a um valor mensal. Suportar variações diárias de inflação
exigiria uma decisão de negócio sobre o índice e sua convenção.

## Convenções

Uma curva não pode misturar valores anuais, diários e mensais. O significado
deve ser suficiente para interpretar todos os seus valores sem depender do
nome escolhido pelo usuário.

A convenção é determinada pelo índice, e não escolhida separadamente pelo
usuário. Nesta etapa, cada índice possui uma única convenção; selecionar CDI,
SELIC ou IPCA também define como interpretar os valores de sua curva.

Convenções aprovadas para esta etapa:

| Índice        | Convenção                                      |
| ------------- | ---------------------------------------------- |
| CDI           | Taxa anual efetiva com base de 252 dias úteis. |
| SELIC efetiva | Taxa anual efetiva com base de 252 dias úteis. |
| IPCA          | Variação acumulada por competência mensal.     |

A SELIC efetiva e a meta SELIC são referenciais distintos. O Banco Central
publica a série 11 como SELIC em percentual ao dia e identifica a série 432
como meta SELIC. Uma eventual conversão na entrada precisa preservar esse
significado. [SELIC diária — Banco Central](https://dadosabertos.bcb.gov.br/pt_BR/dataset/11-taxa-de-juros---selic)
e [meta SELIC — Banco Central](https://bcb.gov.br/estatisticas/detalhamentoGrafico/graficoshome/selic).

Usar uma trajetória de meta SELIC para remunerar uma aplicação exigiria uma
regra explícita de transformação. Essa transformação não está definida.

Valores negativos de inflação precisam ser representáveis. Limites numéricos
e validações respeitam a convenção: CDI e SELIC efetiva admitem taxas iguais
ou superiores a zero; IPCA admite variações maiores que −100%, incluindo
deflação. Os valores são decimais: 12% equivale a 0,12. Valores ausentes são
diferentes de valores explicitamente informados como zero.

## Cobertura e Dados Ausentes

Cobertura é verificada para o cenário escolhido, os dados exigidos pela oferta
e o calendário utilizado. Ter um primeiro e um último valor não comprova
cobertura de todo o intervalo entre eles.

| Situação                                            | Consequência                                                |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Taxa de juros necessária coberta por um intervalo   | Usar o valor declarado.                                     |
| Dia não útil excluído da capitalização              | Não exigir uma taxa de juros para esse dia.                 |
| Taxa necessária ausente entre trechos               | Impedir o cálculo.                                          |
| Taxa necessária anterior ou posterior aos trechos   | Impedir o cálculo.                                          |
| Competência de inflação exigida pela oferta ausente | Impedir o cálculo.                                          |
| Valor explicitamente igual a zero                   | Interpretar conforme a convenção; não tratar como ausência. |

Uma lacuna não deve ser preenchida automaticamente com zero, com o último
valor conhecido ou com uma interpolação. O período descoberto deve ser
identificado para que o usuário possa corrigir o cenário ou escolher outro. O cálculo deverá determinar as referências necessárias; a curva
não escolhe dias úteis nem competências defasadas por conta própria. A forma
de verificar o conjunto de referências será refinada em uma etapa posterior.

### Exemplo de Lacuna Relevante

Uma curva possui taxas de 01/10/2026 a 06/10/2026 e de 08/10/2026 a
31/10/2026. O dia 07/10/2026 é um dia útil no calendário do PRD. Se sua taxa
for necessária ao cálculo, a curva não possui cobertura suficiente.

A presença de valores nos dias anteriores e posteriores não autoriza deduzir
o valor do dia ausente. O cálculo deve ser impedido.

### Exemplo de Intervalo Sem Capitalização

Uma curva possui valores até sexta-feira, 02/10/2026, e a partir de
segunda-feira, 05/10/2026. A ausência de taxas para sábado e domingo não
constitui uma lacuna de juros para a capitalização por dias úteis.

### Cenários Incompletos

É permitido cadastrar um cenário com lacunas, desde que tenha pelo menos um
intervalo. Sua suficiência é verificada a cada cálculo que o usa. Uma
referência necessária ausente impede o cálculo e deve constar do diagnóstico
de cobertura.

Um mesmo cenário pode servir a uma simulação curta e não servir a outra mais
longa, e uma edição pode mudar essa suficiência. Portanto, ela não deve ser
presumida como uma característica permanente e universal do cenário.

Para o IPCA, as competências exigidas podem anteceder a data da aplicação,
conforme a defasagem contratual. Uma busca simples por datas dentro do
período investido não basta para verificar a cobertura de inflação.

## Visibilidade e Propriedade

| Origem  | Visível para                    | Edição e exclusão                                       |
| ------- | ------------------------------- | ------------------------------------------------------- |
| Usuário | Somente o usuário que a criou.  | Pelo dono.                                              |
| Sistema | Todos os usuários autenticados. | Somente por processos do sistema, nunca pela interface. |

- Criar uma curva a partir do zero cria uma curva privada com seu primeiro
  cenário.
- Duplicar um cenário cria um cenário privado na mesma curva. Em uma curva do
  sistema, o usuário vê os cenários do sistema e os seus; os demais usuários
  não veem a cópia. O nome e o índice da curva do sistema continuam fora do
  controle do usuário.
- Uma curva privada contém somente cenários de seu dono.
- Uma simulação só usa cenários visíveis para seu dono. Um cenário privado de
  outro usuário é tratado como inexistente.

## Edição, Revisões e Reação

Editar um cenário altera o próprio cenário: o identificador permanece e a
revisão é incrementada a cada alteração salva. Nome, descrição e intervalos são
editáveis; dividir, substituir ou unir intervalos é uma edição como as demais.

- Cada resultado registra a revisão do cenário que usou. Um resultado cuja
  revisão difere da revisão atual está desatualizado e é recalculado.
- O recálculo é assíncrono. Entre a edição e o novo resultado, a simulação
  exibe o último resultado bem sucedido com seu estado (ver o PRD).
- Uma edição que retira cobertura necessária leva as simulações afetadas a
  "Requer ação", com os períodos descobertos. Corrigir o cenário ou escolher
  outro as devolve ao cálculo.
- Antes de salvar, a interface informa quantas simulações do usuário serão
  recalculadas. Quem quiser preservar a trajetória anterior duplica o cenário
  antes de editá-lo.
- Cada alteração gera um evento com a revisão e o que mudou. Cenários do
  sistema mantidos por processos de importação geram os mesmos eventos, e as
  simulações de todos os usuários que os usam são recalculadas.

Resultados passados não são reproduzíveis: o produto não preserva a trajetória
anterior de um cenário editado nem os resultados calculados com ela.

### Exclusão

Excluir um cenário é definitivo para o usuário, mesmo que o armazenamento
mantenha um registro técnico. Excluir uma curva privada exclui seus cenários.

O cenário excluído deixa de ser encontrado e não pode ser escolhido. As
simulações que o usavam passam a "Requer ação" com o motivo "Sem curva,
escolha outra" e mantêm o último resultado bem sucedido, identificado como
anterior à exclusão, até que o usuário escolha outro cenário. Restauração e
exclusão física não fazem parte desta etapa.

## Histórico e Projeções

A curva pode fornecer premissas para investimentos passados e futuros. A
distinção recomendada é entre valores observados e projetados, especialmente
quando uma trajetória combina histórico com expectativas futuras.

Uma previsão informada explicitamente é um dado do cenário escolhido. Ela
não é uma autorização para preencher lacunas ou extrapolar além dos períodos
declarados. O detalhamento de origem e de classificação por trecho permanece
pendente.

Uma simulação retrospectiva com dados hoje conhecidos não equivale a
reproduzir somente as informações disponíveis ao investidor na época. Esse
segundo comportamento exigiria conhecer quando cada dado foi publicado ou
estava disponível; não está definido no escopo atual.

## Relação com os Cálculos

### CDI: Percentual Aplicado à Taxa Diária

A metodologia da B3 converte o DI anual para uma taxa diária equivalente,
aplica o percentual contratado a essa taxa e acumula os fatores diários.
[Metodologia de cálculo acumulado do DI — B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-calcudo-acumulado-de-di/).

Com valores decimais, 12% equivale a 0,12 e 105% do CDI equivale a 1,05:

```text
taxa_diaria_CDI = (1 + CDI_anual) ^ (1 / 252) - 1
fator_diario_aplicacao = 1 + taxa_diaria_CDI * percentual_contratado
saldo_bruto = saldo_bruto_anterior * fator_diario_aplicacao
```

A curva fornece o CDI anual de referência. O percentual contratado pertence
à oferta. Multiplicar primeiro o CDI anual pelo percentual contratado não
representa essa metodologia. O PRD usa a fórmula diária descrita aqui.

### Data da Taxa e Data do Saldo

A B3 usa taxas da data inicial inclusive até a final exclusive. Já o PRD
define contagem excluindo a data inicial e incluindo a final. É necessário
conciliar a data de referência da taxa com a data do saldo apresentado.
[Metodologia de cálculo acumulado do DI — B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-calcudo-acumulado-de-di/).

A regra confirmada trata a taxa de um dia útil como a remuneração até o próximo
dia útil e apresenta o saldo correspondente na data final desse período.
A aplicação e o vencimento devem ser úteis para executar o cálculo; não há
ajuste automático. Uma simulação com datas não úteis é rejeitada ao ser
salva; uma condição de oferta editada para um vencimento não útil leva as
simulações que a usam a "Requer ação".

O cálculo de percentual da SELIC efetiva usa a mesma convenção temporal e a
mesma aplicação do percentual sobre a taxa diária equivalente. Exige uma curva
de SELIC efetiva em taxa anual base 252, sem substituição por CDI ou meta SELIC.

Para taxas variáveis, manter a quantidade de dias não garante o mesmo
resultado se as datas das taxas utilizadas forem deslocadas. A regra de
cobertura deve usar as datas efetivamente requeridas pelo cálculo.

### IPCA: Atualização e Parcela Fixa

O caderno de fórmulas da B3 para CDBs contempla correção mensal ou anual,
aniversários, proporcionalização e correção defasada conforme o instrumento.
Os juros fixos incidem sobre o valor nominal atualizado pela inflação.
[Caderno de fórmulas de CDBs — B3, seções 2 e 5](https://b3.com.br/data/files/2C/84/37/A0/A394F6109A4874F6AC094EA8/Caderno%20de%20Formulas%20-%20CDBs-DIs-DPGE-LAM-LC-LF-LFS-LFSC-LFSN-IECI-RDB.pdf).

A composição conceitual é multiplicativa:

```text
montante_bruto = principal * fator_IPCA * fator_juros_fixos
```

A ANBIMA descreve, para debêntures indexadas ao IPCA, proporcionalização
geométrica pela razão entre dias úteis decorridos e dias úteis entre
aniversários. Quando o índice fechado está indisponível, há tratamento com
projeções. Essa referência não define uma regra universal para CDBs.
[Guia de metodologias ANBIMA, páginas 45–46](https://www.anbima.com.br/data/files/41/33/64/17/5EAB77103EDB69776B2BA2A8/Guia%20de%20metodologias%20ANBIMA%20de%20Precificacao_161120.pdf).

Distribuir automaticamente uma variação pelos dias úteis do mês civil é uma
simplificação insuficiente para afirmar reprodução de um contrato real.
Precisamos escolher o perfil de atualização por IPCA suportado pelo produto.

| Responsabilidade da curva                    | Responsabilidade das condições da oferta     |
| -------------------------------------------- | -------------------------------------------- |
| Valores por competência e convenção.         | Periodicidade da atualização.                |
| Identidade e revisão do cenário.             | Datas de aniversário ou referência.          |
| Cobertura das competências solicitadas.      | Defasagem e critérios de proporcionalização. |
| Trajetória histórica ou projetada declarada. | Parcela fixa da remuneração e sua base.      |

### Precisão e Calendário

Mantêm-se as regras de precisão e o calendário descritos no PRD. A curva não
define feriados nem muda o calendário conforme os valores nela cadastrados.

As metodologias da B3 possuem truncamentos e arredondamentos próprios.
Reproduzir seus valores exatamente exigiria adotar essas regras, enquanto o
PRD mantém precisão sem arredondamento de negócio. Essa diferença deve ser
considerada na comparação com resultados externos.
[Metodologia de cálculo acumulado do DI — B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-calcudo-acumulado-de-di/).

## Resultados Esperados

A trajetória de saldo bruto é calculada sem descontar tributos durante a
capitalização. Para cada dia útil de apresentação, o resultado contém:

- data do saldo;
- rendimento bruto daquele período diário;
- rendimento bruto acumulado desde a aplicação;
- montante bruto acumulado.

Mostrar o valor do índice e o fator aplicado em cada linha é uma recomendação
para explicar o cálculo, não um requisito de apresentação já aprovado.

O resumo no vencimento contém valor inicial, montante bruto, rendimento bruto,
IOF, IR, total de impostos e montante líquido. As regras tributárias e a ordem
IOF antes de IR são as do PRD. Não há desconto ou coluna de imposto em cada
linha diária neste escopo.

O rendimento diário é a diferença entre saldos brutos consecutivos. O
rendimento bruto acumulado é o montante bruto menos o principal. O resumo
líquido não altera retroativamente a trajetória de capitalização.

O vencimento deve ocorrer em dia útil. A última linha diária apresenta o saldo
bruto no vencimento, enquanto o resumo desconta os tributos. A taxa do vencimento
não é necessária, pois o último intervalo usa a taxa do dia útil anterior.

## Fluxo de Negócio do Cálculo

1. Identificar a condição de oferta, o investimento e o cenário escolhidos, com
   suas revisões atuais.
2. Verificar a compatibilidade entre índice, convenção e remuneração.
3. Determinar as datas ou competências exigidas até o vencimento.
4. Verificar toda a cobertura; se faltar algum dado, impedir o cálculo e
   registrar o motivo com os períodos descobertos.
5. Calcular a trajetória bruta e os resultados de todos os dias úteis.
6. Apurar os tributos e o montante líquido no vencimento.
7. Substituir o resultado atual, registrando as revisões da condição e do
   cenário usadas e a versão da metodologia, somente se essas entradas não
   forem mais antigas que as do resultado registrado.

Uma curva incompatível e um cenário sem cobertura suficiente são motivos
distintos para impedir o cálculo. O usuário deve conseguir identificar qual
condição precisa corrigir. Um cálculo nunca troca silenciosamente o cenário
escolhido por outro.

## Regras de Consistência

- Início e fim inclusivos, com início menor ou igual ao fim.
- Ausência de sobreposição entre trechos de um cenário, mesmo quando seus
  valores são iguais; cada referência necessária resolve para um único valor.
- Identificação explícita da competência em cenários de inflação.
- Cadastro permitido de cenários incompletos com pelo menos um intervalo,
  com diagnóstico de cobertura por cálculo.
- Índice e convenção fixos na curva; uma mudança de significado origina outra
  curva.
- Revisão do cenário sempre crescente; uma alteração salva nunca reutiliza uma
  revisão.

## Pendências de Produto

| Pendência                 | O que precisa ser decidido                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Perfil contratual do IPCA | Definir atualização, aniversário, defasagem, proporcionalização e tratamento das extremidades do investimento. |
| Histórico e projeções     | Definir se a origem observada/projetada é informada por trecho e quais dados de origem serão necessários.      |
| Cadastro de intervalos    | Definir a interface de cadastro e edição dos intervalos de um cenário.                                         |

A decisão de impedir cálculo sem cobertura não é reaberta por essas
pendências. Interpolação, prolongamento e substituição automática de cenários
não estão autorizados como comportamento implícito.

## Fora do Escopo Atual

- Detalhamento técnico de classes, APIs e persistência neste documento.
- Processos de importação automática de séries de fontes externas; o modelo
  já admite curvas do sistema mantidas por eles.
- Construção automática de previsões ou curvas a termo.
- Preenchimento automático de dados ausentes.
- Substituição automática de um índice por outro.
- Resgate, recebimento antecipado e reinvestimento.
- Reprodução de resultados calculados com trajetórias anteriores.
- Reprodução do conjunto de informações disponíveis em cada data histórica.
- Definição completa do agregado de carteira.

A comparação de cenários otimista e pessimista motiva essa preparação, mas não
exige implementar agora um fluxo específico de comparação de cenários.
