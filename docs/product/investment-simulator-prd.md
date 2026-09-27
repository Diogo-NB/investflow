# Simulador de Investimentos em Renda Fixa

PRD condensado para consulta sob demanda. Descreve produto e regras de negócio;
não define arquitetura de software.

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
- tipo: prefixado, pós-fixado por CDI ou híbrido por IPCA;
- taxa fixa, percentual do CDI e/ou IPCA, conforme o tipo;
- liquidez diária ou somente no vencimento;
- data de resgate antecipado, quando permitida.

CDI e IPCA são informados manualmente e armazenados com data de referência.

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
- Instantes exatos usam UTC. A interface os apresenta no fuso
  `America/Sao_Paulo`.
- Datas civis, como aplicação e vencimento, não possuem fuso horário e são
  apresentadas no mesmo dia de calendário informado pelo usuário.
- O rendimento corresponde ao montante bruto menos o valor inicial.
- IR e IOF incidem somente sobre o rendimento.
- O montante líquido corresponde ao montante bruto menos IR e IOF.

### Calendário de Dias Úteis

- Um dia útil exclui sábados, domingos e os feriados nacionais usados pelo
  calendário financeiro da ANBIMA.
- Os feriados fixos são 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro,
  12 de outubro, 2, 15 e 20 de novembro e 25 de dezembro.
- Carnaval (segunda e terça-feira), Paixão de Cristo e Corpus Christi são
  derivados anualmente da data da Páscoa pelo computus gregoriano documentado
  no projeto de domínio.
- A contagem exclui a data inicial e inclui a data final.
- Fechamentos exclusivos da B3, feriados estaduais ou municipais e alterações
  extraordinárias de calendário ficam fora do MVP.

### CDB Prefixado

Usar juros compostos:

```text
montante_bruto = valor_inicial * (1 + taxa_do_periodo) ^ periodos
```

Converter a taxa anual para a periodicidade usada no cálculo.

### CDB Pós-Fixado por CDI

```text
taxa_efetiva = CDI * percentual_do_CDI
```

Aplicar a taxa efetiva usando juros compostos e a convenção de 252 dias úteis.

### CDB Híbrido

Combinar a parcela fixa e a variação do IPCA informada pelo usuário. A fórmula
exata de composição ainda precisa ser definida.

### Imposto de Renda

Aplicar automaticamente a alíquota regressiva conforme o prazo efetivo:

| Prazo efetivo     | Alíquota |
| ----------------- | -------: |
| até 180 dias      |    22,5% |
| 181 a 360 dias    |      20% |
| 361 a 720 dias    |    17,5% |
| acima de 720 dias |      15% |

### IOF

- Aplicar somente em resgates realizados antes de 30 dias.
- Usar tabela regressiva sobre o rendimento.
- A tabela diária exata ainda precisa ser definida.

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

- Persistir portfólios, simulações e índices com data de referência.
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

- Definir fórmula exata para CDB híbrido.
- Definir tabela diária de IOF.
- Validar regra de agregação para portfólios com vencimentos diferentes.
- Definir se prazo tributário usa dias corridos enquanto capitalização usa dias
  úteis.
- Definir arredondamento e precisão monetária.
- Definir significado e cálculo da rentabilidade média do portfólio.
- Definir comportamento após vencimento e eventual resgate.
