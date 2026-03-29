# Documento de Requisitos — Sistema de Gerenciamento de Investimentos

> **Arquitetura:** Modular Monolith | Event-Driven Architecture (EDA) | DDD
> **Stack:** Nx Monorepo | NestJS + TypeScript | PostgreSQL | AWS SQS | Keycloak
> **Propósito:** Projeto showcase profissional

---

## 1. Visão Geral

Sistema backend para gerenciamento de investimentos de renda fixa, com arquitetura orientada a eventos (EDA), modelagem tática DDD e autenticação centralizada via Keycloak. Organizado como Modular Monolith dentro de um Nx Monorepo, onde bounded contexts são representados por libraries e apps independentes.

| Aspecto | Decisão |
|---|---|
| Monorepo | Nx — gerencia apps e libs com fronteiras claras entre bounded contexts |
| Arquitetura | Modular Monolith — bounded contexts como Nx libs, apps como deployable units |
| Estilo | Event-Driven Architecture (EDA) — estado persistido + eventos como side effect |
| Modelagem | Domain-Driven Design (DDD) — Agregados, Entidades, Value Objects |
| Persistência | PostgreSQL (isolamento lógico por organização) |
| Message Broker | AWS SQS (filas por contexto) |
| IAM | Keycloak (OIDC + JWT) |

### 1.1 Estrutura do Monorepo (Nx)

O projeto utiliza Nx para gerenciar o monorepo. Bounded contexts são separados em **libraries** (`libs/`), enquanto unidades deployáveis vivem em **apps** (`apps/`). Por enquanto existe apenas um app (o monolito modular), mas a estrutura permite extrair contextos para apps independentes no futuro sem refatoração de imports.

```
root/
├── apps/
│   └── investments-api/            # App NestJS — monolito modular (única deployable unit por enquanto)
│       ├── src/
│       │   ├── main.ts
│       │   └── app.module.ts       # Importa os módulos de cada bounded context
│       └── project.json
├── libs/
│   ├── investments/                # Bounded Context: Investments (core domain)
│   │   ├── domain/                 # Agregados, Value Objects, Domain Events, Domain Services
│   │   ├── application/            # Use Cases, Commands, Queries, Ports (interfaces)
│   │   └── infrastructure/         # Repositories, SQS Publishers, Adapters
│   ├── portfolio/                  # Bounded Context: Portfolio (supporting)
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   └── shared/                     # Shared Kernel
│       ├── domain/                 # Value Objects compartilhados (Money, etc), base classes
│       ├── infrastructure/         # Outbox, JWT Guard, SQS base consumer, DB config
│       └── types/                  # DTOs públicos, interfaces de contrato entre contextos
├── nx.json
├── tsconfig.base.json
└── package.json
```

**Regras de dependência entre libs (enforced via Nx boundaries):**

| Lib | Pode depender de | Não pode depender de |
|---|---|---|
| `investments/domain` | `shared/domain` | Nenhuma outra lib de infra ou application |
| `investments/application` | `investments/domain`, `shared/domain`, `shared/types` | `portfolio/*`, infra diretamente |
| `investments/infrastructure` | `investments/application`, `shared/infrastructure` | `portfolio/*` |
| `portfolio/*` | `shared/*` | `investments/*` (recebe dados via eventos, não via import) |
| `shared/*` | — | `investments/*`, `portfolio/*` |

> **Princípio:** O Portfolio nunca importa código do Investments. A comunicação é exclusivamente via eventos SQS. O `shared/` contém apenas o que é genuinamente transversal (Money, Outbox, Guards). Se um tipo é usado por apenas um contexto, ele pertence àquele contexto, não ao shared.
| Consistência | Transactional Outbox Pattern (at-least-once delivery) |

---

## 2. Objetivos do Sistema

- Gerenciar investimentos de renda fixa (SELIC, CDI, IPCA) com ciclo de vida completo
- Suportar múltiplos perfis de usuário com controle de acesso granular
- Garantir rastreabilidade completa via eventos de domínio
- Permitir processamento assíncrono escalável via filas SQS
- Demonstrar arquitetura profissional: EDA + DDD + IAM + Modular Monolith

---

## 3. Modelo de Usuários e Acesso

### 3.1 Tipos de Usuário

| Tipo | Papel (Role) | Escopo de Acesso | Interface |
|---|---|---|---|
| Investor | `INVESTOR` | Apenas seus próprios investimentos, orders e applications | App (Mobile/Web) |
| Organization User | `ORG_USER` | Todos os investimentos da organização + gestão de produtos | Admin Web |

### 3.2 Controle de Acesso

- Autenticação via Keycloak (OIDC)
- Autorização via JWT com claims: `userId`, `roles` (`INVESTOR` | `ORG_USER`), `organizationId`
- Validação de JWT em todas as requisições (Guard global no NestJS)
- Isolamento lógico por `organizationId` em todas as queries

---

## 4. Escopo Funcional

### 4.1 Casos de Uso

#### UC-01: Criar Produto de Investimento (ORG_USER)

- ORG_USER define parâmetros: tipo, indexador, taxa, vencimento, PU mínimo, volume total
- Produto criado com status `DRAFT`
- ORG_USER publica o produto → transição para `OPEN`
- Publica `ProductPublishedEvent`

#### UC-02: Criar Order (INVESTOR)

- Investor seleciona um `InvestmentProduct` e informa o `amount` desejado
- **Validação síncrona (API):**
  - Product está `OPEN`?
  - Volume disponível >= amount?
  - Amount >= PU mínimo do Product?
- Se válido: Order criada com status `PENDING`, volume reservado no Product (mesma transação)
- Publica `OrderCreatedEvent` via outbox → SQS

#### UC-03: Analisar Order (Consumer Assíncrono)

- Consumer SQS consome `OrderCreatedEvent`
- Order transita para `ANALYZING`
- Serviço externo de análise de risco é consultado (mockado — simula compliance/decisão)
- **Se aprovada:** Order → `APPROVED`, Application é criada com status `ACTIVE`. Publica `OrderApprovedEvent` e `ApplicationCreatedEvent`
- **Se rejeitada:** Order → `REJECTED`, volume liberado no Product. Publica `OrderRejectedEvent`

#### UC-04: Expiração de Order (Scheduler)

- Scheduler verifica Orders `PENDING` ou `ANALYZING` cujo timeout foi atingido (configurável pela organização, default 2 dias)
- Order → `EXPIRED`, volume liberado no Product
- Publica `OrderExpiredEvent`

#### UC-05: Consultar Investimentos

- Investor → apenas suas próprias Orders e Applications
- Org User → Orders e Applications vinculadas à organização

#### UC-06: Maturação de Application (Scheduler)

- Scheduler verifica Applications `ACTIVE` cuja `endDate` foi atingida
- `InvestmentCalculationService` calcula valor final com base no indexador e taxas do banco
- Application → `MATURED`
- Publica `ApplicationMaturedEvent`

#### UC-07: Resgate de Application (INVESTOR)

- Investor solicita resgate de Application `MATURED`
- Application → `REDEEMED`
- Publica `ApplicationRedeemedEvent`

#### UC-08: Atualizar Posição Consolidada (Portfolio)

- Read model atualizado via projeção de eventos de Application
- Calcula valor atualizado com base no indexador e taxas do banco

### 4.2 Tipos de Investimento

| Tipo | Indexador | Comportamento de Cálculo | Exemplo |
|---|---|---|---|
| SELIC | Taxa básica de juros | `PU = PU_emissão × (1 + taxa_selic)^(DU/252)` | 100% da SELIC |
| CDI | Percentual do CDI | `PU = PU_emissão × (1 + %CDI × taxa_cdi)^(DU/252)` | 110% do CDI |
| IPCA | Inflação + taxa fixa | `PU = PU_emissão × (1 + IPCA) × (1 + spread)^(DU/252)` | IPCA + 5,5% |

> **Nota sobre Market Data:** Uma Lambda AWS externa busca diariamente as taxas atualizadas (SELIC, CDI, IPCA) e insere no PostgreSQL. O sistema sempre assume que existe um valor atualizado disponível na tabela de taxas.

---

## 5. Modelagem DDD — Visão Tática

### 5.1 Bounded Contexts

| Bounded Context | Nx Lib | Responsabilidade | Comunicação |
|---|---|---|---|
| Identity (externo) | — (Keycloak) | Autenticação e autorização | JWT via HTTP headers |
| Investments (core) | `libs/investments/*` | Produtos, orders e applications | Comando via API, Eventos via SQS |
| Portfolio (supporting) | `libs/portfolio/*` | Visão consolidada das posições | Read model (projeção de eventos) |

### 5.2 Contexto: Investments (Core Domain)

O contexto principal do sistema. Contém três agregados com ciclos de vida independentes e interações bem definidas.

---

#### Agregado: InvestmentProduct (Aggregate Root)

O catálogo de produtos disponíveis para investimento. Criado e gerenciado pelo ORG_USER. Controla volume disponível e define os parâmetros que toda Order deve respeitar.

**Campos:**

| Campo | Tipo | Classificação DDD | Descrição |
|---|---|---|---|
| id | ProductId (UUID) | Identity | Identificador único do produto |
| organizationId | OrganizationId (UUID) | Identity | Organização emissora |
| name | string | Primitive | Nome comercial do produto |
| type | InvestmentType (Enum) | Value Object | `SELIC` \| `CDI` \| `IPCA` |
| indexer | Indexer (Value Object) | Value Object | Indexador + configuração (ex: 110% CDI, IPCA + 5.5%) |
| rate | Rate (Value Object) | Value Object | Taxa contratada |
| period | ProductPeriod (Value Object) | Value Object | startDate + endDate do produto |
| minimumAmount | Money (Value Object) | Value Object | PU mínimo para aplicação |
| totalVolume | Money (Value Object) | Value Object | Volume máximo de captação |
| allocatedVolume | Money (Value Object) | Value Object | Volume já reservado/aplicado |
| status | ProductStatus (Enum) | Value Object | `DRAFT` \| `OPEN` \| `CLOSED` |
| createdAt | Date | Metadata | Timestamp de criação |

**State Machine:**

```
DRAFT → OPEN → CLOSED
```

| Transição | Trigger | Regra |
|---|---|---|
| DRAFT → OPEN | ORG_USER publica | Todos os campos obrigatórios preenchidos |
| OPEN → CLOSED | Volume esgotado ou ORG_USER fecha | Pode ser automático (volume) ou manual |

**Invariantes:**

1. `allocatedVolume` nunca ultrapassa `totalVolume`
2. Apenas produtos `OPEN` aceitam novas Orders
3. `minimumAmount` deve ser positivo
4. `endDate` > `startDate`
5. Tipo e indexador devem ser compatíveis (SELIC não aceita % CDI)

**Métodos:**

- `InvestmentProduct.create(props)` — Factory method, status = DRAFT
- `product.publish()` — DRAFT → OPEN, valida campos obrigatórios
- `product.reserveVolume(amount)` — Incrementa `allocatedVolume`, valida contra `totalVolume`
- `product.releaseVolume(amount)` — Decrementa `allocatedVolume` (rejeição/expiração de Order)
- `product.close()` — OPEN → CLOSED

**Eventos:**

- `ProductPublishedEvent` — produto disponível para investidores
- `ProductClosedEvent` — produto não aceita mais orders

---

#### Agregado: Order (Aggregate Root)

Representa a intenção do investidor de aplicar em um produto. Passa por validação síncrona (API) e assíncrona (serviço de risco). Reserva volume no Product durante sua existência.

**Campos:**

| Campo | Tipo | Classificação DDD | Descrição |
|---|---|---|---|
| id | OrderId (UUID) | Identity | Identificador único da order |
| investorId | UserId (UUID) | Identity | Investidor que criou a order |
| productId | ProductId (UUID) | Reference | Referência ao produto |
| amount | Money (Value Object) | Value Object | Valor que o investidor quer aplicar |
| status | OrderStatus (Enum) | Value Object | `PENDING` \| `ANALYZING` \| `APPROVED` \| `REJECTED` \| `EXPIRED` |
| expiresAt | Date | Primitive | Timestamp de expiração (configurável pela org, default 2 dias) |
| rejectionReason | string (nullable) | Primitive | Motivo da rejeição (se aplicável) |
| createdAt | Date | Metadata | Timestamp de criação |
| updatedAt | Date | Metadata | Timestamp da última atualização |

**State Machine:**

```
PENDING → ANALYZING → APPROVED
                    → REJECTED
PENDING → EXPIRED
ANALYZING → EXPIRED
```

| Transição | Trigger | Efeito |
|---|---|---|
| PENDING → ANALYZING | Consumer inicia análise | Serviço de risco consultado |
| ANALYZING → APPROVED | Análise aprovada | Application criada, volume confirmado |
| ANALYZING → REJECTED | Análise rejeitada | Volume liberado no Product |
| PENDING → EXPIRED | Timeout atingido (scheduler) | Volume liberado no Product |
| ANALYZING → EXPIRED | Timeout atingido (scheduler) | Volume liberado no Product |

**Invariantes:**

1. `amount` deve ser >= `minimumAmount` do Product referenciado
2. Product referenciado deve estar `OPEN` no momento da criação
3. Transições de status são unidirecionais (sem rollback)
4. Apenas Orders `PENDING` ou `ANALYZING` podem expirar
5. `expiresAt` é calculado na criação com base na config da organização

**Métodos:**

- `Order.create(props, product)` — Factory method, valida contra Product, status = PENDING
- `order.startAnalysis()` — PENDING → ANALYZING
- `order.approve()` — ANALYZING → APPROVED
- `order.reject(reason)` — ANALYZING → REJECTED
- `order.expire()` — PENDING/ANALYZING → EXPIRED

**Eventos:**

- `OrderCreatedEvent` — ordem registrada, volume reservado
- `OrderAnalysisStartedEvent` — análise de risco iniciada
- `OrderApprovedEvent` — ordem aprovada, Application será criada
- `OrderRejectedEvent` — ordem rejeitada, volume liberado
- `OrderExpiredEvent` — ordem expirou, volume liberado

---

#### Agregado: Application (Aggregate Root)

Representa a posição real do investidor — o investimento concretizado. Criada automaticamente quando uma Order é aprovada. Carrega o ciclo de vida financeiro com cálculos de valor baseados no indexador.

**Campos:**

| Campo | Tipo | Classificação DDD | Descrição |
|---|---|---|---|
| id | ApplicationId (UUID) | Identity | Identificador único da application |
| orderId | OrderId (UUID) | Reference | Order que originou esta application |
| investorId | UserId (UUID) | Identity | Investidor dono da posição |
| productId | ProductId (UUID) | Reference | Produto de investimento |
| organizationId | OrganizationId (UUID) | Identity | Organização emissora |
| type | InvestmentType (Enum) | Value Object | `SELIC` \| `CDI` \| `IPCA` |
| appliedAmount | Money (Value Object) | Value Object | Valor efetivamente aplicado |
| currentValue | Money (Value Object) | Value Object | Valor atualizado calculado |
| rate | Rate (Value Object) | Value Object | Taxa contratada (snapshot do Product) |
| period | ApplicationPeriod (Value Object) | Value Object | startDate + endDate |
| status | ApplicationStatus (Enum) | Value Object | `ACTIVE` \| `MATURED` \| `REDEEMED` |
| createdAt | Date | Metadata | Timestamp de criação |
| updatedAt | Date | Metadata | Timestamp da última atualização |

**State Machine:**

```
ACTIVE → MATURED → REDEEMED
```

| Transição | Trigger | Efeito |
|---|---|---|
| ACTIVE → MATURED | endDate atingida (scheduler) | Valor final calculado |
| MATURED → REDEEMED | Solicitação de resgate (investor) | Posição encerrada |

**Invariantes:**

1. `appliedAmount` é imutável após criação (snapshot da Order)
2. `rate` é imutável (snapshot do Product no momento da aprovação)
3. Apenas Applications `ACTIVE` recebem atualização de valor
4. Apenas Applications `MATURED` podem ser resgatadas
5. `endDate` > `startDate`

**Métodos:**

- `Application.createFromOrder(order, product)` — Factory method, status = ACTIVE
- `application.updateValue(newValue)` — Atualiza `currentValue` (apenas se ACTIVE)
- `application.mature(finalValue)` — ACTIVE → MATURED
- `application.redeem()` — MATURED → REDEEMED

**Eventos:**

- `ApplicationCreatedEvent` — posição ativa, portfólio deve atualizar
- `ApplicationValueUpdatedEvent` — valor recalculado
- `ApplicationMaturedEvent` — investimento venceu
- `ApplicationRedeemedEvent` — investimento resgatado

---

### 5.3 Value Objects Compartilhados

| Value Object | Campos | Validação | Uso |
|---|---|---|---|
| Money | `amount` (Decimal) + `currency` (BRL) | amount > 0 | Product, Order, Application |
| Rate | `value` (Decimal) + `referenceType` (PERCENTAGE_CDI \| FIXED \| IPCA_PLUS) | value > 0 | Product, Application |
| InvestmentType | Enum: `SELIC` \| `CDI` \| `IPCA` | — | Product, Application |
| Owner | `ownerId` (UUID) + `ownerType` (USER \| ORGANIZATION) | ORG_USER requer organizationId | Cross-aggregate |

### 5.4 Domain Services

**InvestmentCalculationService** — Calcula o valor atualizado de uma Application com base no tipo (SELIC/CDI/IPCA) e nas taxas disponíveis no banco. Utiliza Strategy Pattern — cada tipo de investimento tem sua própria estratégia de cálculo.

**InvestmentMaturationService** — Serviço de domínio invocado pelo scheduler. Busca Applications `ACTIVE` cuja `endDate` foi atingida, calcula valor final e executa `mature()` no agregado.

**OrderExpirationService** — Serviço de domínio invocado pelo scheduler. Busca Orders `PENDING` ou `ANALYZING` cujo `expiresAt` foi atingido, executa `expire()` e libera volume no Product.

**RiskAnalysisService** — Porta (interface) para o serviço externo de análise de risco. Implementação mockada que simula compliance/decisão com latência configurável. Retorna `APPROVED` ou `REJECTED` com reason.

---

### 5.5 Contexto: Portfolio (Supporting Subdomain)

> **Decisão Arquitetural:** O Portfolio não possui lógica de negócio própria (sem limites de alocação, sem rebalanceamento). Ele é uma projeção CQRS que consome eventos do contexto Investments e mantém uma visão consolidada materializada no PostgreSQL.

**Projeção: PortfolioPosition**

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador da posição |
| ownerId | UUID | Usuário ou organização |
| ownerType | USER \| ORGANIZATION | Tipo do dono |
| investmentType | SELIC \| CDI \| IPCA | Tipo do investimento |
| totalInvested | Decimal | Soma dos amounts aplicados |
| currentValue | Decimal | Valor atualizado consolidado |
| activeCount | Integer | Quantidade de applications ativas |
| lastUpdatedAt | Date | Timestamp da última atualização |

A projeção é atualizada por um consumer SQS que escuta eventos de Application (`Created`, `ValueUpdated`, `Matured`, `Redeemed`).

### 5.6 Contexto: Identity (Generic Subdomain)

Totalmente externo — delegado ao Keycloak. O sistema consome apenas os dados do JWT token: `userId`, `roles`, `organizationId`. Não há entidades de domínio neste contexto dentro do sistema.

### 5.7 Market Data (Infraestrutura Externa)

Não é um bounded context do sistema. Uma Lambda AWS externa busca diariamente as taxas atualizadas e insere na tabela `market_rates` do PostgreSQL.

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador |
| indexer | SELIC \| CDI \| IPCA | Tipo do indexador |
| value | Decimal | Valor da taxa |
| referenceDate | Date | Data de referência da taxa |
| createdAt | Date | Timestamp de inserção |

---

## 6. Eventos do Sistema

### 6.1 Envelope Padrão

```
{
  eventId: UUID,
  eventType: string,
  timestamp: ISO-8601,
  correlationId: UUID,
  actorId: UUID,
  payload: { ... }
}
```

### 6.2 Catálogo de Eventos

| Evento | Publicado Quando | Payload Principal | Consumidor |
|---|---|---|---|
| ProductPublishedEvent | ORG_USER publica produto | productId, type, rate, totalVolume | — (notificação futura) |
| ProductClosedEvent | Produto fechado | productId, reason | — |
| OrderCreatedEvent | Investor cria order | orderId, productId, investorId, amount | Order Consumer |
| OrderAnalysisStartedEvent | Consumer inicia análise | orderId | — |
| OrderApprovedEvent | Análise aprovada | orderId, productId, amount | Application Creator |
| OrderRejectedEvent | Análise rejeitada | orderId, reason | Portfolio (futuro) |
| OrderExpiredEvent | Timeout atingido | orderId, releasedVolume | — |
| ApplicationCreatedEvent | Order aprovada → Application | applicationId, investorId, type, amount | Portfolio Projection |
| ApplicationValueUpdatedEvent | Valor recalculado | applicationId, newValue | Portfolio Projection |
| ApplicationMaturedEvent | endDate atingida | applicationId, finalValue | Portfolio Projection |
| ApplicationRedeemedEvent | Resgate solicitado | applicationId, redeemedAt | Portfolio Projection |

---

## 7. Fluxos Principais

### 7.1 Fluxo: Criação de Produto (ORG_USER)

1. ORG_USER autenticado envia `POST /products` com JWT válido
2. Guard valida JWT e extrai claims (role = ORG_USER, organizationId)
3. `InvestmentProduct.create()` — status = DRAFT
4. ORG_USER envia `PATCH /products/:id/publish`
5. `product.publish()` — DRAFT → OPEN, valida campos obrigatórios
6. `ProductPublishedEvent` salvo no outbox e publicado via SQS

### 7.2 Fluxo: Criação de Order + Análise (INVESTOR)

1. Investor autenticado envia `POST /orders` com `productId` e `amount`
2. Guard valida JWT e extrai claims (role = INVESTOR)
3. **Validação síncrona:** Product OPEN? Volume disponível? Amount >= PU mínimo?
4. Se falhar: retorna 400/422 com motivo
5. Se ok: `Order.create()` + `product.reserveVolume(amount)` na mesma transação
6. Order status = PENDING, `OrderCreatedEvent` salvo no outbox
7. Outbox Publisher envia para SQS
8. Consumer consome evento, `order.startAnalysis()` → ANALYZING
9. `RiskAnalysisService` é consultado (mockado)
10. **Se aprovado:** `order.approve()`, `Application.createFromOrder(order, product)` → ACTIVE
11. **Se rejeitado:** `order.reject(reason)`, `product.releaseVolume(amount)`
12. Eventos publicados via outbox → SQS
13. Portfolio Projection consumer atualiza read model

### 7.3 Fluxo: Maturação

1. Scheduler executa `InvestmentMaturationService` periodicamente
2. Service busca Applications `ACTIVE` com `endDate <= now()`
3. Para cada: `InvestmentCalculationService` calcula valor final
4. `application.mature(finalValue)` — ACTIVE → MATURED
5. `ApplicationMaturedEvent` salvo no outbox e publicado via SQS
6. Portfolio Projection atualiza posição consolidada

### 7.4 Fluxo: Resgate

1. Investor solicita `POST /applications/:id/redeem`
2. Valida que Application está `MATURED` e pertence ao investor
3. `application.redeem()` — MATURED → REDEEMED
4. `ApplicationRedeemedEvent` publicado via outbox → SQS
5. Portfolio Projection atualiza posição

### 7.5 Fluxo: Expiração de Order

1. Scheduler executa `OrderExpirationService` periodicamente
2. Busca Orders `PENDING` ou `ANALYZING` com `expiresAt <= now()`
3. Para cada: `order.expire()`, `product.releaseVolume(amount)`
4. `OrderExpiredEvent` publicado via outbox → SQS

---

## 8. Comunicação entre Bounded Contexts

### 8.1 Contrato Público dos Módulos

Cada bounded context é uma Nx library com contrato público definido via `shared/types`. Nenhuma lib acessa diretamente o repository ou entidade de domínio de outra lib. Dependências entre libs são enforced via `@nx/enforce-module-boundaries`.

| De | Para | Mecanismo | O Que Flui |
|---|---|---|---|
| Identity (Keycloak) | Investments | JWT (HTTP Header) | userId, roles, organizationId |
| Investments | Portfolio | Eventos via SQS | Domain Events (Application lifecycle) |
| Investments | Market Data (tabela) | Leitura direta (DB) | Taxas atualizadas para cálculo |

### 8.2 Padrão Outbox

Para garantir consistência entre a persistência do estado e a publicação de eventos, o sistema utiliza o padrão Transactional Outbox:

- O evento de domínio é salvo na tabela `outbox_events` dentro da mesma transação do agregado
- Um Outbox Publisher (polling ou CDC) lê eventos pendentes e publica no SQS
- Após confirmação de publicação, marca o evento como publicado
- Garante at-least-once delivery + consistência eventual

---

## 9. Requisitos Não Funcionais

### 9.1 Resiliência

| Mecanismo | Implementação | Propósito |
|---|---|---|
| Retry | Exponential backoff no consumer SQS | Tolerar falhas transientes |
| Dead Letter Queue (DLQ) | Fila separada no SQS | Isolar mensagens problemáticas |
| Idempotência | Controle por `eventId` (tabela `processed_events`) | Evitar processamento duplicado |
| Transactional Outbox | Tabela `outbox_events` + publisher | Consistência estado/evento |
| Order Timeout | Scheduler + `expiresAt` | Liberar volume reservado em orders abandonadas |

### 9.2 Observabilidade

**Logs Estruturados:**
- Campos obrigatórios: `userId`, `organizationId`, `correlationId`, `eventType`
- Formato: JSON estruturado

**Métricas:**
- Latência de API (p50, p95, p99)
- Tempo em fila SQS
- Tempo de processamento do consumer
- Backlog de mensagens (approximate message count)
- Taxa de erros e DLQ depth
- Taxa de aprovação/rejeição de Orders

### 9.3 Segurança

- Validação de JWT em todas as requisições (Guard NestJS)
- Autorização baseada em roles via decorators customizados
- Isolamento por `organizationId` em todas as queries (WHERE clause)
- Rate limiting nas APIs públicas

---

## 10. Multi-Tenancy

Isolamento lógico por `organizationId`. Sem isolamento físico de banco (intencional para simplificar a infra). Todas as queries são filtradas pelo escopo extraído do JWT.

> **Regra Fundamental:** Nenhuma query ao banco de dados deve ser executada sem filtro de escopo (`userId` para INVESTOR, `organizationId` para ORG_USER). Isso é garantido na camada de repository.

---

## 11. Limitações Intencionais

- Sem conexão com mercado real (taxas via Lambda + seed)
- Sem marcação a mercado complexa (MtM simplificado)
- Sem múltiplos indexadores avançados (apenas SELIC, CDI, IPCA)
- Sem liquidez ou resgate antecipado complexo
- Sem CQRS completo (read model apenas para Portfolio)
- Serviço de análise de risco é mockado (simula latência e decisão)

---

## 12. Roadmap

| Fase | Escopo | Entregável |
|---|---|---|
| 1. Identity | Setup Keycloak + integração JWT com NestJS | Guard funcional + roles |
| 2. Domain Model | Agregados (Product, Order, Application) + Value Objects | Entidades de domínio testadas |
| 3. Product CRUD | API de produtos com autorização ORG_USER | Endpoints de catálogo |
| 4. Order Flow | API de orders com validação síncrona + reserva de volume | Fluxo de intenção |
| 5. Events + Outbox | Publicação de eventos via Transactional Outbox | Eventos no SQS |
| 6. Order Consumer | Consumer SQS + análise assíncrona + criação de Application | Fluxo completo |
| 7. Cálculo | InvestmentCalculationService (SELIC/CDI/IPCA) | Valores atualizados |
| 8. Portfolio | Read model + projeção de eventos | Posição consolidada |
| 9. Schedulers | Maturação + Expiração de Orders | Ciclos de vida automatizados |
| 10. Resiliência | Retry + DLQ + Idempotência | Sistema tolerante a falhas |
| 11. Observabilidade | Logs estruturados + métricas | Dashboards operacionais |
| 12. Carga (TCC) | Gerador de carga + medição de backlog/latência | Relatório de performance |

---

## 13. Critérios de Sucesso

- Usuário autenticado opera dentro do seu escopo sem vazamento de dados
- Organizações isoladas corretamente em todas as operações
- Produtos são gerenciados pelo ORG_USER e consumidos pelo INVESTOR
- Orders passam por dupla validação (síncrona + assíncrona) com reserva de volume
- Applications evoluem de estado corretamente (state machine validada)
- Volume do Product é consistente (reservas + liberações corretas)
- Eventos dirigem o processamento end-to-end (EDA visível)
- Sistema observável e testável sob carga
- Modelagem DDD coerente com bounded contexts bem definidos
