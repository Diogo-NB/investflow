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

A curva descreve essa trajetória. Podem existir várias curvas para o mesmo
índice, como uma trajetória base e alternativas otimista e pessimista. Esses
nomes identificam premissas escolhidas para o experimento; não representam
garantia de retorno ou classificação obrigatória das curvas.

O produto precisa reproduzir os resultados mesmo depois de o usuário criar
uma nova trajetória a partir de uma curva existente.
Também precisa reconhecer quando os dados escolhidos não cobrem o período
necessário, em vez de produzir silenciosamente um resultado incompleto.

## Uso Pretendido

O usuário:

1. Seleciona uma oferta.
2. Informa a data de aplicação, que pode estar no passado.
3. Informa o valor inicial.
4. Seleciona uma curva compatível com o índice necessário à remuneração.
5. Executa a simulação e consulta os resultados de todos os dias úteis.

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
| Curva             | Trajetória identificada de valores de um único índice.                                     |
| Convenção         | Significado dos valores: unidade, periodicidade e base de capitalização, quando aplicável. |
| Intervalo         | Período declarado ao qual um valor se refere.                                              |
| Competência       | Período econômico medido por um índice, como um mês de inflação.                           |
| Cobertura         | Disponibilidade dos valores necessários para um cálculo específico.                        |
| Oferta            | Condições de remuneração e prazo do investimento escolhido.                                |
| Simulação         | Hipótese de investir um valor em uma data sob termos digitados ou copiados de uma oferta.  |
| Cálculo           | Registro imutável do resultado da simulação com as curvas e premissas selecionadas.        |
| Rendimento diário | Diferença entre o saldo bruto calculado e o saldo bruto anterior.                          |

Uma curva é uma trajetória de premissas do simulador. Não se presume que ela
seja uma curva de juros a termo extraída de preços de mercado.

## Decisões Confirmadas

| Decisão                      | Regra                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Representação por intervalos | Os valores possuem início e fim explícitos.                                                     |
| Capacidade diária            | Início igual ao fim representa um intervalo de um único dia, quando compatível com a convenção. |
| Convenção única              | Uma curva inteira utiliza uma única convenção de valores.                                       |
| Ausência de cobertura        | A falta de um valor necessário impede o cálculo.                                                |
| Imutabilidade                | Cada alteração cria outra curva com outro identificador; a original permanece preservada.       |
| Limites dos intervalos       | Início e fim inclusivos, sem sobreposição entre trechos.                                        |
| Cadastro incompleto          | Lacunas são permitidas, mas a curva precisa ter pelo menos um intervalo.                        |
| Convenções iniciais          | CDI e SELIC efetiva em taxa anual base 252; IPCA em variação mensal.                            |
| Valores                      | Juros não negativos; inflação maior que −100%; zero é permitido.                                |
| Resultado diário             | O cálculo fornece rendimento e acumulação brutos para todos os dias úteis do período.           |
| Tributos                     | IOF e IR são apurados e apresentados somente no resumo do vencimento.                           |
| Horizonte atual              | O cálculo não considera saída ou recebimento antecipado.                                        |

As regras exatas do CDI e do híbrido foram objeto de pesquisa de mercado
solicitada durante a definição do produto. O CDI e as pendências do IPCA estão
detalhados adiante.

## Identidade e Responsabilidades da Curva

A curva possui identidade própria, independente de ofertas e simulações.
Ela organiza valores de um índice segundo uma convenção e permite que o
usuário escolha uma trajetória reconhecível e preserve suas premissas.

Informações conceituais necessárias:

- identidade e nome da curva;
- índice representado;
- convenção derivada do índice para interpretar os valores;
- descrição opcional das premissas;
- intervalos e valores imutáveis.

A curva não possui o valor investido, o percentual do CDI contratado, a taxa
fixa da oferta, o vencimento do investimento ou suas regras tributárias. Uma
mesma curva pode alimentar várias hipóteses com resultados diferentes.

A curva é uma unidade de negócio independente. Nome, descrição, índice,
convenção e intervalos permanecem imutáveis depois da criação. Renomear,
alterar uma premissa ou corrigir um valor significa criar outra curva.

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
| Taxa necessária anterior ou posterior aos trechos   | Impedir o cálculo.                                          |
| Competência de inflação exigida pela oferta ausente | Impedir o cálculo.                                          |
| Valor explicitamente igual a zero                   | Interpretar conforme a convenção; não tratar como ausência. |

Uma lacuna não deve ser preenchida automaticamente com zero, com o último
valor conhecido ou com uma interpolação. O período descoberto deve ser
identificado para que o usuário possa criar uma curva corrigida ou escolher
outra curva. O cálculo deverá determinar as referências necessárias; a curva
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

### Curvas Incompletas

É permitido cadastrar uma curva com lacunas, desde que tenha pelo menos um
intervalo. Sua suficiência é verificada quando ela for usada. Uma referência
necessária ausente impede o cálculo e deve constar do diagnóstico de cobertura.

Uma mesma curva pode servir a uma simulação curta e não servir a outra
mais longa. Portanto, sua suficiência não deve ser presumida como uma
característica permanente e universal da curva.

Para o IPCA, as competências exigidas podem anteceder a data da aplicação,
conforme a defasagem contratual. Uma busca simples por datas dentro do
período investido não basta para verificar a cobertura de inflação.

## Imutabilidade e Reprodução

Cada curva identifica um conteúdo definitivo. A decisão inicial de manter
revisões foi substituída pela criação de novas curvas imutáveis. Cada
alteração recebe outro identificador e preserva a curva original.

Exemplo:

1. O cálculo A usa a curva CDI base, identificada por X.
2. O usuário cria outra curva, identificada por Y, com valores ajustados.
3. O cálculo A continua vinculado à curva X.
4. Um novo cálculo pode selecionar Y para comparar resultados.

O identificador da curva é suficiente para identificar seu conteúdo
preservado. O cálculo fixa esse identificador e não troca suas premissas
automaticamente quando outra curva é criada. Gravar novamente uma curva com um
identificador já existente preserva o conteúdo originalmente armazenado. A
exclusão lógica altera apenas o estado de disponibilidade da curva.

A reprodução completa também depende da hipótese da simulação, dos termos
da oferta, do calendário e das regras de cálculo utilizados. Preservar a curva
é necessário, mas não suficiente para preservar todos esses elementos. Por
isso, cada cálculo registrado fixa a curva, uma cópia dos termos da oferta, o
valor inicial, a data de aplicação e a versão da metodologia, além dos
resultados calculados.

### Exclusão Lógica

A curva pode ser excluída logicamente, seguindo o comportamento das ofertas.
Ela registra o instante da primeira exclusão. Repetir a exclusão não altera
esse instante, o identificador, as premissas ou os intervalos.

Curvas excluídas deixam de ser encontradas na consulta normal por identidade
e não podem ser usadas em novos cálculos, mesmo por simulações cujos cálculos
anteriores as usaram. A exclusão preserva o conteúdo armazenado: cálculos
registrados antes da exclusão continuam consultáveis com seus resultados
originais. Restauração e exclusão física não fazem parte desta
etapa.

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
ajuste automático. Hipóteses com datas não úteis podem ser cadastradas, mas
o calculador retorna um erro explícito.

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
| Identidade das premissas imutáveis.          | Datas de aniversário ou referência.          |
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

1. Identificar os termos, o investimento e a curva escolhidos.
2. Fixar o identificador da curva imutável usada neste cálculo.
3. Verificar a compatibilidade entre índice, convenção e remuneração.
4. Determinar as datas ou competências exigidas até o vencimento.
5. Verificar toda a cobertura; se faltar algum dado, impedir o cálculo.
6. Calcular a trajetória bruta e os resultados de todos os dias úteis.
7. Apurar os tributos e o montante líquido no vencimento.
8. Preservar a identificação das premissas usadas para consultar e reproduzir
   o resultado.

Uma curva incompatível e uma curva sem cobertura suficiente são motivos
distintos para impedir o cálculo. O usuário deve conseguir identificar qual
condição precisa corrigir. Consultar um resultado existente não deve fazê-lo
passar silenciosamente para outra curva.

## Regras de Consistência da Curva

- Início e fim inclusivos, com início menor ou igual ao fim.
- Ausência de sobreposição entre trechos de uma curva, mesmo quando seus
  valores são iguais; cada referência necessária resolve para um único valor.
- Identificação explícita da competência em curvas de inflação.
- Cadastro permitido de curvas incompletas com pelo menos um intervalo,
  com diagnóstico de cobertura por cálculo.
- Índice e convenção estáveis na identidade da curva; uma mudança de
  significado originaria outra curva.
- Preservação das curvas usadas mesmo se uma curva deixar de ser oferecida
  para novos cálculos.

Dividir, substituir ou unir intervalos produz outra curva. Essas operações
precisam preservar o significado da trajetória que o usuário pretende criar.

## Pendências de Produto

| Pendência                 | O que precisa ser decidido                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Perfil contratual do IPCA | Definir atualização, aniversário, defasagem, proporcionalização e tratamento das extremidades do investimento. |
| Reprodução após exclusão  | Definir o acesso às curvas excluídas por simulações que já utilizavam suas premissas preservadas.              |
| Histórico e projeções     | Definir se a origem observada/projetada é informada por trecho e quais dados de origem serão necessários.      |
| Escolha e reprodução      | Definir o fluxo de seleção e a vinculação da curva imutável à simulação e ao cálculo.                          |

A decisão de impedir cálculo sem cobertura não é reaberta por essas
pendências. Interpolação, prolongamento e substituição automática de curvas
não estão autorizados como comportamento implícito.

## Fora do Escopo Atual

- Detalhamento técnico de classes, APIs e persistência neste documento.
- Importação automática de séries de fontes externas.
- Construção automática de previsões ou curvas a termo.
- Preenchimento automático de dados ausentes.
- Substituição automática de um índice por outro.
- Resgate, recebimento antecipado e reinvestimento.
- Reprodução do conjunto de informações disponíveis em cada data histórica.
- Definição completa do agregado de carteira.

A comparação de trajetórias otimista e pessimista motiva essa preparação,
mas não exige implementar agora um fluxo específico de comparação de cenários.
