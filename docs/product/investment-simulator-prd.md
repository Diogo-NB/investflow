# Simulador de Investimentos em Renda Fixa

PRD condensado para consulta sob demanda. Descreve produto e regras de negócio;
não define arquitetura de software.

O contexto de negócio, as decisões confirmadas e as pendências das curvas
estão detalhados em [Curvas de Valores dos Índices](./index-value-curves.md).

## Visão

Simulador educacional para planejar e comparar investimentos brasileiros de
renda fixa. O MVP cobre CDBs e permite persistir portfólios e simulações.

O produto não executa transações financeiras reais.

## Problema

Investidores iniciantes precisam estimar rendimento líquido considerando prazo,
tributos, índices e liquidez. Calculadoras existentes frequentemente não
permitem persistir portfólios, comparar cenários ou reproduzir simulações.

## Usuário e Acesso

- Usuário pessoa física autenticado via Keycloak.
- Contas são provisionadas previamente por administradores.
- Autocadastro não faz parte do MVP.
- Cada usuário acessa somente seus próprios portfólios e simulações.

## Escopo do MVP

### Portfólios

- Criar, consultar, renomear e excluir múltiplos portfólios.
- Nome e descrição identificam um portfólio.
- Um portfólio agrupa múltiplas simulações de CDB.
- Comparar portfólios por valores agregados e rentabilidade média.

### Simulações de CDB

- Criar, consultar, editar e excluir simulações.
- Comparar duas ou mais simulações lado a lado.
- Executar experimentos alterando taxa, percentual do CDI e datas.

Dados de entrada:

- valor inicial;
- data de aplicação;
- data de vencimento ou prazo;
- tipo: prefixado, pós-fixado por CDI ou SELIC efetiva, ou híbrido por IPCA;
- taxa fixa, percentual do CDI ou SELIC e/ou IPCA, conforme o tipo;
- liquidez diária ou somente no vencimento;
- data de resgate antecipado, quando permitida.

CDI, SELIC efetiva e IPCA são informados manualmente e armazenados com data de referência.
Esses valores compõem curvas selecionáveis, com intervalos explícitos,
convenção única e conteúdo imutável. Alterações criam outra curva com outro
identificador. Podem existir várias curvas para o
mesmo índice. A falta de cobertura necessária impede o cálculo.

No recorte atual das curvas, a execução calcula a trajetória bruta de todos
os dias úteis até o vencimento, sem recebimentos antecipados. IOF e IR aparecem
somente no resumo do vencimento. A funcionalidade geral de resgate antecipado
descrita neste PRD permanece fora desse recorte.

O calculador inicial suporta CDB prefixado, percentual do CDI e percentual da
SELIC efetiva. IPCA permanece previsto no produto, mas seu cálculo fica adiado
até a definição do perfil contratual.

### Execuções de Simulação

- A aplicação registra a curva escolhida quando a remuneração é indexada; a
  curva deve ser do mesmo índice da remuneração e não pode estar excluída.
- O cálculo é executado por comando explícito do usuário. Cada execução bem
  sucedida é registrada como um registro imutável e somente acrescentado,
  contendo as entradas usadas (snapshot da oferta, curva, valor inicial e data
  de aplicação), a versão da metodologia, o instante do cálculo, o resumo no
  vencimento e a trajetória diária bruta.
- Falhas de cálculo são devolvidas ao usuário e não são registradas.
- Editar a aplicação não altera execuções anteriores. Uma execução é
  apresentada como desatualizada quando as entradas atuais da aplicação ou a
  metodologia vigente diferem das registradas.
- A versão da metodologia muda sempre que fórmulas, convenções ou o calendário
  alterarem os valores calculados.
- Execuções de aplicações excluídas deixam de ser consultáveis.

### Resultados

Por simulação:

- montante bruto;
- rendimento bruto;
- IR;
- IOF, quando aplicável;
- montante líquido;
- rentabilidade mensal, anualizada e total;
- prazo restante;
- data de vencimento.

Por portfólio:

- soma dos valores aplicáveis;
- rentabilidade média;
- comparação agregada entre portfólios.

No MVP, apresentar resultados em tabelas simples. Gráficos e exportação para
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

### Calendário de Dias Úteis

- Um dia útil exclui sábados, domingos e os feriados nacionais usados pelo
  calendário financeiro da ANBIMA.
- Os feriados fixos são 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro,
  12 de outubro, 2, 15 e 20 de novembro e 25 de dezembro.
- Carnaval (segunda e terça-feira), Paixão de Cristo e Corpus Christi são
  derivados anualmente da data da Páscoa pelo computus gregoriano documentado
  no domínio compartilhado.
- A contagem exclui a data inicial e inclui a data final.
- A execução exige aplicação e vencimento em dias úteis, sem ajuste automático.
  A hipótese pode ser cadastrada com outras datas, mas não pode ser calculada.
- Fechamentos exclusivos da B3, feriados estaduais ou municipais e alterações
  extraordinárias de calendário ficam fora do MVP.

### CDB Prefixado

Usar juros compostos:

```text
montante_bruto = valor_inicial * (1 + taxa_do_periodo) ^ periodos
```

Converter a taxa anual para a periodicidade usada no cálculo.

### CDB Pós-Fixado por CDI

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

### CDB Pós-Fixado por SELIC Efetiva

Usar a curva de SELIC efetiva em taxa anual base 252, convertendo a taxa anual
para a equivalente diária antes de aplicar o percentual contratado:

```text
taxa_diaria_SELIC = (1 + SELIC_anual) ^ (1 / 252) - 1
fator_diario_aplicacao = 1 + taxa_diaria_SELIC * percentual_da_SELIC
saldo_bruto = saldo_bruto_anterior * fator_diario_aplicacao
```

Usar a mesma convenção de datas do CDI. A remuneração exige uma curva de SELIC;
uma curva de CDI não pode substituí-la. Não há conversão implícita da meta SELIC.

### CDB Híbrido

Compor multiplicativamente o fator de atualização pelo IPCA e o fator da
parcela fixa. O perfil contratual de atualização, incluindo aniversário,
defasagem e proporcionalização, ainda precisa ser definido. O contexto de
mercado e suas implicações estão na documentação de curvas.

### Imposto de Renda

Aplicar automaticamente a alíquota regressiva conforme o prazo efetivo em dias
corridos:

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
somar somente aplicações ainda ativas, sem reinvestir aplicações já vencidas.

Esta regra pode excluir do total aplicações vencidas anteriormente e deve ser
validada antes da implementação.

## Requisitos Não Funcionais

- Persistir portfólios, simulações, execuções e índices com data de referência.
- Manter histórico suficiente para reproduzir simulações.
- Autenticar por token.
- Registrar alterações de parâmetros e execuções de simulações para auditoria.
- Interface em português, responsiva e acessível.
- Permitir futura internacionalização.

## Fora do Escopo do MVP

- transações financeiras reais;
- autocadastro;
- atualização automática de CDI, IPCA ou Selic;
- gráficos;
- exportação PDF/CSV;
- aportes recorrentes e reinvestimento automático;
- rentabilidade real ajustada pela inflação;
- análise de risco ou rating de emissores;
- alertas sobre limite do FGC;
- outros títulos além de CDB;
- multi-moeda.

## Evolução Futura

- Importar índices de fontes como Banco Central, ANBIMA ou BrasilAPI.
- Armazenar histórico de índices para simulações retrospectivas.
- Suportar Tesouro Direto, LCI/LCA, debêntures, CRI e CRA.
- Comparar rendimento líquido entre diferentes tipos de título.
- Exibir rentabilidade real descontada pelo IPCA.
- Simular aportes regulares, reinvestimentos e taxas variáveis.
- Adicionar gráficos, relatórios e exportações.
- Adicionar análise de risco, rating, FGC e suporte multi-moeda.

## Regras Futuras Relevantes

- FGC cobre determinados títulos em até R$ 250.000 por CPF e instituição.
- LCI/LCA são isentas de IR para pessoa física e cobertas pelo FGC.
- Tesouro Direto não é coberto pelo FGC.
- Debêntures e CRI/CRA não são cobertos pelo FGC.

## Pendências de Produto

- Definir o perfil contratual de atualização e a fórmula completa do CDB
  híbrido, conforme a documentação de curvas.
- Validar regra de agregação para portfólios com vencimentos diferentes.
- Definir significado e cálculo da rentabilidade média do portfólio.
- Definir comportamento após vencimento e eventual resgate.
