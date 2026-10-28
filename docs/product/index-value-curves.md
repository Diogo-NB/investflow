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

Cada curva é uma dessas trajetórias, como uma trajetória base e alternativas
otimista e pessimista do mesmo índice, cada uma em sua própria curva. Esses
nomes identificam premissas escolhidas para o experimento; não representam
garantia de retorno ou classificação obrigatória das curvas.

O usuário ajusta suas curvas ao longo do tempo, e o sistema mantém curvas
públicas atualizadas. As simulações que usam uma curva acompanham essas
mudanças. O produto também precisa reconhecer quando os dados escolhidos não
cobrem o período necessário, em vez de produzir silenciosamente um resultado
incompleto.

## Uso Pretendido

O usuário:

1. Seleciona uma oferta.
2. Informa a data de aplicação, que pode estar no passado.
3. Informa o valor inicial.
4. Seleciona uma curva do índice necessário à remuneração.
5. Salva a simulação e acompanha seu resultado, calculado de forma assíncrona,
   com os valores de todos os dias úteis.

Quando a curva muda, a simulação é recalculada e o resultado passa a refletir
os novos valores.

O horizonte deste recorte termina no vencimento da oferta. Resgate antecipado
e recebimentos antes do vencimento estão fora deste escopo, mesmo quando a
oferta possui liquidez diária.

O investimento prefixado não necessita de uma curva de índice para remunerar
o capital: sua taxa vem da oferta. A curva é necessária quando o cálculo
depende de um índice. O conjunto exato de modalidades inicialmente suportadas
continua subordinado ao PRD e às pendências deste documento.

A escolha de uma curva de SELIC não substitui automaticamente uma curva de
CDI exigida pela oferta. A disponibilidade de diferentes índices não significa
que eles possam ser trocados sem uma regra de negócio específica.

## Vocabulário

| Conceito          | Significado no simulador                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Índice            | Referencial econômico identificado, como CDI, SELIC efetiva ou IPCA.                       |
| Curva             | Trajetória de valores de um único índice, com nome, descrição opcional, intervalos e dono. |
| Convenção         | Significado dos valores: unidade, periodicidade e base de capitalização, quando aplicável. |
| Intervalo         | Período declarado ao qual um valor se refere.                                              |
| Competência       | Período econômico medido por um índice, como um mês de inflação.                           |
| Cobertura         | Disponibilidade dos valores necessários para um cálculo específico.                        |
| Revisão           | Número da curva incrementado a cada alteração salva.                                       |
| Oferta            | Título, emissor, remuneração, taxa, vencimento e liquidez de um investimento.              |
| Simulação         | Hipótese de investir um valor em uma data sob uma oferta e, se indexada, uma curva.        |
| Resultado         | Cálculo atual da simulação, com as revisões das premissas que usou.                        |
| Rendimento diário | Diferença entre o saldo bruto calculado e o saldo bruto anterior.                          |

Uma curva é uma trajetória de premissas do simulador. Não se presume que ela
seja uma curva de juros a termo extraída de preços de mercado.

## Decisões Confirmadas

| Decisão                      | Regra                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Representação por intervalos | Os valores possuem início e fim explícitos; depois do último fim, o último valor vale em diante.        |
| Capacidade diária            | Início igual ao fim representa um intervalo de um único dia, quando compatível com a convenção.         |
| Convenção única              | Todos os valores de uma curva utilizam a convenção do seu índice.                                       |
| Ausência de cobertura        | A falta de um valor necessário impede o cálculo.                                                        |
| Curvas independentes         | Cada curva fixa seu índice e é editável por seu dono; não há grupo de curvas no modelo.                 |
| Edição                       | Editar uma curva altera a própria curva, incrementa sua revisão e recalcula as simulações que a usam.   |
| Visibilidade                 | Curvas de usuários são privadas; curvas do sistema são públicas e somente leitura para usuários.        |
| Duplicação                   | Duplicar cria uma curva privada com o mesmo índice e o mesmo conteúdo, inclusive de curvas do sistema.  |
| Exclusão                     | Excluir é definitivo para o usuário; simulações que usavam a curva passam a "Requer ação".              |
| Limites dos intervalos       | Início e fim inclusivos, sem sobreposição entre trechos.                                                |
| Cadastro completo            | Sem dias úteis (ou meses, no IPCA) faltando entre o primeiro e o último intervalo (decisão 2026-10-13). |
| Convenções iniciais          | CDI e SELIC efetiva em taxa anual base 252; IPCA em variação mensal.                                    |
| Valores                      | Juros não negativos; inflação maior que −100%; zero é permitido.                                        |
| Resultado diário             | O cálculo fornece rendimento e acumulação brutos para todos os dias úteis do período.                   |
| Tributos                     | IOF e IR são apurados e apresentados somente no resumo do vencimento.                                   |
| Horizonte atual              | O cálculo não considera saída ou recebimento antecipado.                                                |
| Cadastro de intervalos       | Tabela editável com uma linha por intervalo (início, fim e valor), mantida contígua; no IPCA, meses.    |
| Último valor mantido         | Depois do fim do último intervalo, seu valor vale em diante, sempre identificado (decisão 2026-10-28).  |
| Curvas do BCB                | O sistema mantém CDI e SELIC efetiva com os valores do Banco Central e a última taxa mantida em diante. |

As regras exatas do CDI e do híbrido foram objeto de pesquisa de mercado
solicitada durante a definição do produto. O CDI e a pesquisa sobre o IPCA estão
detalhados adiante.

## Curva e Responsabilidades

A curva possui identidade própria, independente de ofertas e simulações. Ela
fixa o índice e, por ele, a convenção que interpreta todos os seus valores.

| Fixo após a criação             | Editável pelo dono                        |
| ------------------------------- | ----------------------------------------- |
| Identidade.                     | Nome e descrição opcional.                |
| Índice e, por ele, a convenção. | Intervalos e valores.                     |
| Dono: um usuário ou o sistema.  | A revisão acompanha cada alteração salva. |

O índice nunca muda; mudar o índice significa criar outra curva. Alternativas
do mesmo índice, como base, otimista e pessimista, são curvas distintas. A
interface as apresenta agrupadas por índice e por origem (do sistema ou
minhas), ordenadas pelo nome; o agrupamento é apenas apresentação e não é
guardado.

A curva não possui o valor investido, o percentual do CDI contratado, a taxa
fixa da oferta, o vencimento do investimento ou suas regras tributárias. Uma
mesma curva pode alimentar várias simulações com resultados diferentes.

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

Cobertura é verificada para a curva escolhida, os dados exigidos pela oferta
e o calendário utilizado. Ter um primeiro e um último valor não comprova
cobertura de todo o intervalo entre eles.

| Situação                                            | Consequência                                                |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Taxa de juros necessária coberta por um intervalo   | Usar o valor declarado.                                     |
| Dia não útil excluído da capitalização              | Não exigir uma taxa de juros para esse dia.                 |
| Taxa necessária ausente entre trechos               | Impedir o cálculo.                                          |
| Taxa necessária anterior aos trechos                | Impedir o cálculo.                                          |
| Taxa necessária posterior ao último trecho          | Usar o valor do último trecho, identificado como mantido.   |
| Competência de inflação exigida pela oferta ausente | Impedir o cálculo.                                          |
| Valor explicitamente igual a zero                   | Interpretar conforme a convenção; não tratar como ausência. |

Uma lacuna não deve ser preenchida automaticamente com zero, com o último
valor conhecido ou com uma interpolação. Manter o último valor depois do fim
da curva não é preenchimento de lacuna: é regra da curva, sempre identificada
(ver [Taxa Mantida e Curvas do BCB](#taxa-mantida-e-curvas-do-bcb)). O
período descoberto deve ser identificado para que o usuário possa corrigir a
curva ou escolher outra. O cálculo deverá determinar as referências
necessárias; a curva não escolhe dias úteis nem competências defasadas por
conta própria. A forma de verificar o conjunto de referências será refinada
em uma etapa posterior.

### Exemplo de Lacuna Recusada

Uma curva possui taxas de 01/10/2026 a 06/10/2026 e de 08/10/2026 a
31/10/2026. O dia 07/10/2026 é um dia útil no calendário do PRD, então a
curva não pode ser salva assim: falta o valor de 07/10/2026.

A presença de valores nos dias anteriores e posteriores não autoriza deduzir
o valor do dia ausente; o usuário informa o valor que falta.

### Exemplo de Intervalo Sem Capitalização

Uma curva possui valores até sexta-feira, 02/10/2026, e a partir de
segunda-feira, 05/10/2026. A ausência de taxas para sábado e domingo não
constitui uma lacuna de juros para a capitalização por dias úteis.

### Curvas Completas

Decisão de 2026-10-13: uma curva precisa ter pelo menos um intervalo e não
pode ter lacunas. Entre o primeiro e o último intervalo, todo dia útil de uma
curva diária (CDI e SELIC efetiva) e todo mês de uma curva mensal (IPCA) tem
valor. Fins de semana e feriados sem valor não são lacunas, pois a
capitalização por dias úteis não os lê.

A cobertura continua sendo verificada a cada cálculo, mas só pode faltar antes
do primeiro intervalo: depois do último, seu valor é mantido. Uma edição que
muda o primeiro início pode mudar essa suficiência.

Para o IPCA, as competências exigidas podem anteceder a data da aplicação,
conforme a defasagem contratual. Uma busca simples por datas dentro do
período investido não basta para verificar a cobertura de inflação.

## Visibilidade e Propriedade

| Origem  | Visível para                    | Edição e exclusão                                       |
| ------- | ------------------------------- | ------------------------------------------------------- |
| Usuário | Somente o usuário que a criou.  | Pelo dono.                                              |
| Sistema | Todos os usuários autenticados. | Somente por processos do sistema, nunca pela interface. |

- Criar uma curva cria uma curva privada do usuário.
- Duplicar uma curva, inclusive do sistema, cria uma curva privada do usuário
  com o mesmo índice e o mesmo conteúdo, chamada "<nome> (cópia)". Os demais
  usuários não veem a cópia.
- Uma simulação só usa curvas visíveis para seu dono. Uma curva privada de
  outro usuário é tratada como inexistente.

## Edição, Revisões e Reação

Editar uma curva altera a própria curva: o identificador permanece e a
revisão é incrementada a cada alteração salva. Nome, descrição e intervalos são
editáveis; dividir, substituir ou unir intervalos é uma edição como as demais.

- Cada resultado registra a revisão da curva que usou. Um resultado cuja
  revisão difere da revisão atual está desatualizado e é recalculado.
- O recálculo é assíncrono. Entre a edição e o novo resultado, a simulação
  exibe o último resultado bem sucedido com seu estado (ver o PRD).
- Uma edição que retira cobertura necessária leva as simulações afetadas a
  "Requer ação", com os períodos descobertos. Corrigir a curva ou escolher
  outra as devolve ao cálculo.
- Antes de salvar, a interface informa quantas simulações do usuário serão
  recalculadas. Quem quiser preservar a trajetória anterior duplica a curva
  antes de editá-la.
- Cada alteração gera um evento que identifica a curva alterada. Curvas do
  sistema mantidas por processos de importação geram os mesmos eventos, e as
  simulações de todos os usuários que os usam são recalculadas.

Resultados passados não são reproduzíveis: o produto não preserva a trajetória
anterior de uma curva editada nem os resultados calculados com ela.

### Exclusão

Excluir uma curva é definitivo para o usuário, mesmo que o armazenamento
mantenha um registro técnico. Cópias da curva são curvas independentes e não
são afetadas.

A curva excluída deixa de ser encontrada e não pode ser escolhida. As
simulações que o usavam passam a "Requer ação" com o motivo "Sem curva,
escolha outra" e mantêm o último resultado bem sucedido, identificado como
anterior à exclusão, até que o usuário escolha outra curva. Restauração e
exclusão física não fazem parte desta etapa.

## Histórico e Projeções

A curva pode fornecer premissas para investimentos passados e futuros. A
distinção recomendada é entre valores observados e projetados, especialmente
quando uma trajetória combina histórico com expectativas futuras.

Uma previsão informada explicitamente é um dado da curva escolhida. Ela
não autoriza preencher lacunas; depois do último trecho vale o último valor,
sempre identificado. Nas curvas do BCB, a data do último valor
publicado separa o histórico da taxa mantida (ver
[Taxa Mantida e Curvas do BCB](#taxa-mantida-e-curvas-do-bcb)). O
detalhamento de origem e de classificação por trecho permanece pendente.

Uma simulação retrospectiva com dados hoje conhecidos não equivale a
reproduzir somente as informações disponíveis ao investidor na época. Esse
segundo comportamento exigiria conhecer quando cada dado foi publicado ou
estava disponível; não está definido no escopo atual.

## Taxa Mantida e Curvas do BCB

Decisão de 2026-10-17. Uma curva com somente valores já publicados termina
no dia anterior ao atual, pois o CDI de um dia é publicado no dia seguinte.
Ela não serviria para simular uma oferta que ainda não venceu, nem uma
aplicação feita hoje. A taxa mantida permite essas simulações sem esconder do
usuário que o futuro é uma premissa.

### Último Valor Mantido

Decisão de 2026-10-28, que substitui o intervalo sem fim de 2026-10-17.

- Todo intervalo tem início e fim. Depois do fim do último intervalo, o
  valor dele vale para todas as referências seguintes; nenhuma curva deixa
  de cobrir o futuro.
- O fim do último intervalo é a última data declarada: a partir do dia
  seguinte, o valor é mantido. Mudar a premissa futura é editar ou adicionar
  intervalos.
- Nas curvas mensais (IPCA), o último valor vale para todas as competências
  depois do último mês.
- A taxa mantida é sempre explícita. As telas que mostram uma curva informam
  que o último valor vale em diante, e o gráfico identifica o trecho mantido.
  O resultado de uma simulação informa até quando a curva tem valores e que,
  depois, a taxa é mantida.

### Curvas do BCB

- O sistema mantém uma curva de CDI e uma de SELIC efetiva com os valores
  publicados pelo Banco Central do Brasil (BCB), na convenção desses índices (taxa anual
  efetiva, base 252).
- Como em toda curva, a última taxa publicada é mantida depois do fim do
  último intervalo.
- Essas são as curvas do sistema. Um processo automático as mantém,
  importando os valores publicados em uma frequência definida.
- A importação compara o último valor publicado com o último intervalo. Um
  valor igual estende o fim do último intervalo. Um valor diferente abre um
  novo intervalo a partir da data desse valor.
  Dias consecutivos com o mesmo valor formam um único intervalo.
- As simulações só devem ser recalculadas quando a taxa muda; no CDI, isso
  acontece em torno das reuniões do Copom. Como estender o fim sem recalcular
  é uma decisão pendente (ver [BCB Rate Import](./planned/bcb-rate-import.md)).
- As telas da curva informam a origem dos valores, a data do último valor
  publicado e que a última taxa é mantida em diante.
- Quem quiser outra premissa para o futuro duplica a curva e edita os
  intervalos futuros. A cópia é independente e não recebe os novos valores
  publicados.

### Dias Sem Valor Publicado (Decisão Provisória)

O calendário do produto não inclui fechamentos exclusivos da B3 nem
alterações extraordinárias (ver o PRD). Nesses dias, ele exige uma taxa que o
Banco Central não publica. Provisoriamente, a importação repete o valor do dia
útil anterior nesses dias, para que a curva continue sem lacunas. A decisão
pode ser revista (ver [Pendências de Produto](#pendências-de-produto)).

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
salva; uma oferta editada para um vencimento não útil leva as
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
simplificação insuficiente para afirmar reprodução de um contrato real. A
escolha do perfil de atualização por IPCA fica para depois da primeira versão
(ver a Evolução Futura no [PRD](./investment-simulator-prd.md#evolução-futura)).

| Responsabilidade da curva                    | Responsabilidade da oferta                   |
| -------------------------------------------- | -------------------------------------------- |
| Valores por competência e convenção.         | Periodicidade da atualização.                |
| Identidade e revisão da curva.               | Datas de aniversário ou referência.          |
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

1. Identificar a oferta, o investimento e a curva escolhidos, com
   suas revisões atuais.
2. Verificar a compatibilidade entre índice, convenção e remuneração.
3. Determinar as datas ou competências exigidas até o vencimento.
4. Verificar toda a cobertura; se faltar algum dado, impedir o cálculo e
   registrar o motivo com os períodos descobertos.
5. Calcular a trajetória bruta e os resultados de todos os dias úteis.
6. Apurar os tributos e o montante líquido no vencimento.
7. Substituir o resultado atual, registrando as revisões da oferta e da
   curva usadas e a versão da metodologia, somente se essas entradas não
   forem mais antigas que as do resultado registrado.

Uma curva incompatível e uma curva sem cobertura suficiente são motivos
distintos para impedir o cálculo. O usuário deve conseguir identificar qual
condição precisa corrigir. Um cálculo nunca troca silenciosamente a curva
escolhida por outra.

## Regras de Consistência

- Início e fim inclusivos, com início menor ou igual ao fim.
- Ausência de sobreposição entre trechos de uma curva, mesmo quando seus
  valores são iguais; cada referência necessária resolve para um único valor.
- Identificação explícita da competência em curvas de inflação.
- Pelo menos um intervalo e nenhum dia útil (ou mês, no IPCA) faltando entre
  o primeiro e o último; a cobertura antes do primeiro é diagnosticada por
  cálculo, e depois do último vale o último valor.
- Índice e convenção fixos na curva; uma mudança de significado origina outra
  curva.
- Revisão da curva sempre crescente; uma alteração salva nunca reutiliza uma
  revisão.

## Pendências de Produto

| Pendência                | O que precisa ser decidido                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Histórico e projeções    | Definir se a origem observada/projetada é informada por trecho e quais dados de origem serão necessários. |
| Dias sem valor publicado | Rever a repetição provisória do valor anterior nos dias úteis do produto sem valor do Banco Central.      |

A decisão de impedir cálculo sem cobertura não é reaberta por essas
pendências. Interpolação, prolongamento e substituição automática de curvas
não estão autorizados como comportamento implícito; manter o último valor
depois do fim é regra da curva, sempre identificada.

## Fora do Escopo Atual

- Detalhamento técnico de classes, APIs e persistência neste documento.
- Importação de outros índices e fontes além do CDI e da SELIC efetiva do
  Banco Central.
- Construção automática de previsões ou curvas a termo.
- Preenchimento automático de dados ausentes.
- Substituição automática de um índice por outro.
- Cálculo de títulos híbridos por IPCA.
- Resgate, recebimento antecipado e reinvestimento.
- Reprodução de resultados calculados com trajetórias anteriores.
- Reprodução do conjunto de informações disponíveis em cada data histórica.
- Definição completa do agregado de carteira.

A comparação de curvas otimista e pessimista motiva essa preparação, mas não
exige implementar agora um fluxo específico de comparação de curvas.
