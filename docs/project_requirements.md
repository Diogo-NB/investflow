# Documento de Requisitos — Sistema de Gerenciamento de Investimentos

> **Arquitetura:** Modular Monolith | Event-Driven Architecture (EDA) | DDD
> **Stack:** Nx Monorepo | NestJS + TypeScript | PostgreSQL | AWS SNS + SQS | Keycloak
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
| Message Broker | AWS SNS + SQS (SNS pub/sub por bounded context, SQS por consumer) |
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
│   │   └── infrastructure/         # Repositories, SNS Publishers, Adapters
│   ├── portfolio/                  # Bounded Context: Portfolio (supporting)
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   └── shared/                     # Shared Kernel
│       ├── domain/                 # Value Objects compartilhados (Money, etc), base classes
│       ├── infrastructure/         # Outbox, JWT Guard, SNS publisher, SQS base consumer, DB config
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

> **Princípio:** O Portfolio nunca importa código do Investments. A comunicação é exclusivamente via eventos (SNS → SQS). O `shared/` contém apenas o que é genuinamente transversal (Money, Outbox, Guards). Se um tipo é usado por apenas um contexto, ele pertence àquele contexto, não ao shared.
| Consistência | Transactional Outbox Pattern (at-least-once delivery) |

---

## 2. Objetivos do Sistema

- Gerenciar investimentos de renda fixa (SELIC, CDI, IPCA) com ciclo de vida completo
- Suportar múltiplos perfis de usuário com controle de acesso granular
- Garantir rastreabilidade completa via eventos de domínio
- Permitir processamento assíncrono escalável via SNS + SQS
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
  - Product está `OPEN`? (`product.validateAcceptsOrders()`)
  - Volume disponível >= amount? (query derivada: `totalVolume − SUM(orders.amount) WHERE status IN (PENDING, ANALYZING, APPROVED)`)
  - Amount >= PU mínimo do Product?
- Se válido: `Order.create()` com status `PENDING` — **apenas o agregado Order é modificado** (single aggregate per transaction)
- `OrderCreatedEvent` salvo na tabela `outbox_events` dentro da mesma transação
- Após criação, use case verifica se volume do Product esgotou → se sim, `product.close()` em transação separada (consistência eventual)

#### UC-03: Analisar Order (Consumer Assíncrono)

- Consumer SQS consome `OrderCreatedEvent`
- Order transita para `ANALYZING`
- Serviço externo de análise de risco é consultado (mockado — simula compliance/decisão)
- **Se aprovada:** Order → `APPROVED`, Application é criada com status `ACTIVE`. Publica `OrderApprovedEvent` e `ApplicationCreatedEvent`
- **Se rejeitada:** Order → `REJECTED`. Publica `OrderRejectedEvent`. O volume é automaticamente liberado — Orders em estado terminal são excluídas da query derivada de volume

#### UC-04: Expiração de Order (Scheduler)

- Scheduler verifica Orders `PENDING` ou `ANALYZING` cujo timeout foi atingido (configurável pela organização, default 2 dias)
- Order → `EXPIRED` (single aggregate transaction). Volume automaticamente liberado via query derivada
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
| Investments (core) | `libs/investments/*` | Produtos, orders e applications | Comando via API, Eventos via SNS |
| Portfolio (supporting) | `libs/portfolio/*` | Visão consolidada das posições | Read model (projeção de eventos) |

### 5.2 Contexto: Investments (Core Domain)

O contexto principal do sistema. Contém três agregados com ciclos de vida independentes e interações bem definidas.

---

#### Agregado: InvestmentProduct (Aggregate Root)

O catálogo de produtos disponíveis para investimento. Criado e gerenciado pelo ORG_USER. Define os parâmetros (volume máximo, PU mínimo, indexador) que toda Order deve respeitar. O volume alocado é um valor derivado — calculado a partir da soma dos amounts de Orders em estados não-terminais (`PENDING`, `ANALYZING`, `APPROVED`) — e nunca armazenado no agregado.

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
| status | ProductStatus (Enum) | Value Object | `DRAFT` \| `OPEN` \| `CLOSED` |
| createdAt | Date | Metadata | Timestamp de criação |

**State Machine:**

```
DRAFT → OPEN → CLOSED
```

| Transição | Trigger | Regra |
|---|---|---|
| DRAFT → OPEN | ORG_USER publica | Todos os campos obrigatórios preenchidos |
| OPEN → CLOSED | ORG_USER fecha manualmente ou volume esgotado (detectado após criação de Order) | Fechamento por volume é eventual — verificado via query derivada |

**Invariantes:**

1. Apenas produtos `OPEN` aceitam novas Orders
2. `minimumAmount` deve ser positivo
3. `endDate` > `startDate`
4. Tipo e indexador devem ser compatíveis (SELIC não aceita % CDI)
5. Volume disponível (`totalVolume` − soma de Orders ativas) é validado no use case via query derivada — não é responsabilidade do agregado

**Métodos:**

- `InvestmentProduct.create(props)` — Factory method, status = DRAFT
- `product.publish()` — DRAFT → OPEN, valida campos obrigatórios
- `product.validateAcceptsOrders()` — Verifica que status é OPEN (read-only, sem mutação)
- `product.close()` — OPEN → CLOSED

**Eventos:**

- `ProductPublishedEvent` — produto disponível para investidores
- `ProductClosedEvent` — produto não aceita mais orders

---

#### Agregado: Order (Aggregate Root)

Representa a intenção do investidor de aplicar em um produto. Passa por validação síncrona (API — volume disponível via query derivada) e assíncrona (serviço de risco). Enquanto em estado não-terminal (`PENDING`, `ANALYZING`, `APPROVED`), seu amount é contabilizado na query de volume alocado do Product.

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
| ANALYZING → APPROVED | Análise aprovada | Application criada |
| ANALYZING → REJECTED | Análise rejeitada | Amount excluído da query de volume (estado terminal) |
| PENDING → EXPIRED | Timeout atingido (scheduler) | Amount excluído da query de volume (estado terminal) |
| ANALYZING → EXPIRED | Timeout atingido (scheduler) | Amount excluído da query de volume (estado terminal) |

**Invariantes:**

1. `amount` deve ser >= `minimumAmount` do Product referenciado
2. Product referenciado deve estar `OPEN` no momento da criação
3. Transições de status são unidirecionais (sem rollback)
4. Apenas Orders `PENDING` ou `ANALYZING` podem expirar
5. `expiresAt` é calculado na criação com base na config da organização

**Métodos:**

- `Order.create(props)` — Factory method, status = PENDING (volume validation happens in use case via derived query, not in aggregate)
- `order.startAnalysis()` — PENDING → ANALYZING
- `order.approve()` — ANALYZING → APPROVED
- `order.reject(reason)` — ANALYZING → REJECTED
- `order.expire()` — PENDING/ANALYZING → EXPIRED

**Eventos:**

- `OrderCreatedEvent` — ordem registrada
- `OrderAnalysisStartedEvent` — análise de risco iniciada
- `OrderApprovedEvent` — ordem aprovada, Application será criada
- `OrderRejectedEvent` — ordem rejeitada (amount automaticamente excluído do volume derivado)
- `OrderExpiredEvent` — ordem expirou (amount automaticamente excluído do volume derivado)

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

**OrderExpirationService** — Serviço de domínio invocado pelo scheduler. Busca Orders `PENDING` ou `ANALYZING` cujo `expiresAt` foi atingido, executa `expire()`. O volume é automaticamente liberado pois o estado terminal da Order exclui seu amount da query derivada de volume alocado.

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

A projeção é atualizada por um consumer SQS (`investflow-portfolio-events`) que recebe eventos de Application (`Created`, `ValueUpdated`, `Matured`, `Redeemed`) via subscrição ao tópico SNS `investflow-investments`.

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
| OrderExpiredEvent | Timeout atingido | orderId, productId, amount | — |
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
6. `ProductPublishedEvent` salvo no outbox → OutboxPoller publica no SNS `investflow-investments`

### 7.2 Fluxo: Criação de Order + Análise (INVESTOR)

1. Investor autenticado envia `POST /orders` com `productId` e `amount`
2. Guard valida JWT e extrai claims (role = INVESTOR)
3. **Validação síncrona:**
   - `product.validateAcceptsOrders()` — status OPEN?
   - Query derivada: `SUM(orders.amount) WHERE product_id = ? AND status IN ('PENDING','ANALYZING','APPROVED')` — volume disponível >= amount?
   - Amount >= PU mínimo do Product?
4. Se falhar: retorna 400/422 com motivo
5. Se ok: `Order.create()` — **single aggregate transaction** (apenas Order é modificado)
6. `OrderCreatedEvent` salvo no outbox na mesma transação
7. Use case verifica se volume do Product esgotou → se sim, `product.close()` em transação separada
8. OutboxPoller publica no SNS `investflow-investments` → SQS faz fan-out
9. Consumer consome da fila SQS, `order.startAnalysis()` → ANALYZING
10. `RiskAnalysisService` é consultado (mockado)
11. **Se aprovado:** `order.approve()`, `Application.createFromOrder(order, product)` → ACTIVE
12. **Se rejeitado:** `order.reject(reason)` — volume automaticamente liberado (estado terminal excluído da query derivada)
13. Eventos publicados via outbox → SNS → SQS
14. Portfolio Projection consumer consome da fila SQS e atualiza read model

### 7.3 Fluxo: Maturação

1. Scheduler executa `InvestmentMaturationService` periodicamente
2. Service busca Applications `ACTIVE` com `endDate <= now()`
3. Para cada: `InvestmentCalculationService` calcula valor final
4. `application.mature(finalValue)` — ACTIVE → MATURED
5. `ApplicationMaturedEvent` salvo no outbox → OutboxPoller publica no SNS → SQS
6. Portfolio Projection atualiza posição consolidada

### 7.4 Fluxo: Resgate

1. Investor solicita `POST /applications/:id/redeem`
2. Valida que Application está `MATURED` e pertence ao investor
3. `application.redeem()` — MATURED → REDEEMED
4. `ApplicationRedeemedEvent` publicado via outbox → SNS → SQS
5. Portfolio Projection atualiza posição

### 7.5 Fluxo: Expiração de Order

1. Scheduler executa `OrderExpirationService` periodicamente
2. Busca Orders `PENDING` ou `ANALYZING` com `expiresAt <= now()`
3. Para cada: `order.expire()` — **single aggregate transaction** (apenas Order é modificado)
4. Volume automaticamente liberado — estado terminal exclui o amount da query derivada
5. `OrderExpiredEvent` publicado via outbox → SNS → SQS

---

## 8. Comunicação entre Bounded Contexts

### 8.1 Contrato Público dos Módulos

Cada bounded context é uma Nx library com contrato público definido via `shared/types`. Nenhuma lib acessa diretamente o repository ou entidade de domínio de outra lib. Dependências entre libs são enforced via `@nx/enforce-module-boundaries`.

| De | Para | Mecanismo | O Que Flui |
|---|---|---|---|
| Identity (Keycloak) | Investments | JWT (HTTP Header) | userId, roles, organizationId |
| Investments | Portfolio | SNS → SQS | Domain Events (Application lifecycle) |
| Investments | Market Data (tabela) | Leitura direta (DB) | Taxas atualizadas para cálculo |

### 8.2 Padrão Transactional Outbox

Para garantir consistência entre a persistência do estado e a publicação de eventos, o sistema utiliza o padrão Transactional Outbox.

**Princípio:** O evento de domínio é salvo na tabela `outbox_events` dentro da mesma transação do agregado. Um poller assíncrono lê eventos pendentes e publica no SQS. Garante at-least-once delivery + consistência eventual.

**Tabela `outbox_events`:**

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador único do evento |
| event_type | string | Nome do evento (ex: `OrderCreatedEvent`) |
| payload | JSONB | Dados serializados do evento (segue envelope padrão §6.1) |
| aggregate_id | string | ID do agregado que originou o evento |
| aggregate_type | string | Tipo do agregado (ex: `Order`, `InvestmentProduct`) |
| context | string | Bounded context de origem (`investments` \| `portfolio`) — determina qual tópico SNS usar |
| correlation_id | UUID | ID de correlação para rastreabilidade |
| actor_id | UUID | Usuário que disparou a ação |
| created_at | timestamptz | Timestamp de criação |
| published_at | timestamptz (nullable) | Timestamp de publicação — `null` = pendente |

**Fluxo:**

1. Use case chama `aggregate.method()` → domain events coletados via `this.apply()`
2. Use case chama `repo.save(aggregate)` — **`BaseRepository.save()` faz tudo atomicamente:**
   - Persiste o estado do agregado no banco
   - Lê `aggregate.getDomainEvents()` e insere na tabela `outbox_events` (com `context` do bounded context)
   - Chama `aggregate.clearDomainEvents()`
3. Steps 2a-2c ocorrem na **mesma transação** (via `TransactionInterceptor` + `AsyncLocalStorage`)
4. `OutboxPollerService` (`@Cron`, a cada 5s) lê eventos com `published_at IS NULL`
5. Para cada evento, usa o campo `context` para determinar o tópico SNS e publica via `IMessageBroker`
6. Após confirmação do SNS, marca `published_at`
7. SNS faz fan-out para as SQS queues subscritas

**Padrão BaseRepository:**

- `BaseRepository<T extends AggregateRoot>` — classe abstrata em `shared/infrastructure`
- Define `save(aggregate: T)` como método final (não sobrescrito): persiste + drena eventos + limpa
- Subclasses implementam apenas `persistAggregate(aggregate, client)` — a lógica DB específica do agregado
- Use cases **nunca** chamam `getDomainEvents()` ou `clearDomainEvents()` diretamente — apenas `repo.save()`

### 8.3 Topologia de Mensageria (SNS + SQS)

O sistema utiliza SNS como barramento pub/sub por bounded context, com SQS dedicado por consumer. O publisher (OutboxPoller) conhece apenas o tópico SNS — não sabe quem consome.

**Tópicos SNS:**

| Tópico | Publisher | Descrição |
|---|---|---|
| `investflow-investments` | OutboxPollerService | Todos os domain events do contexto Investments |

**Filas SQS:**

| Fila | Subscrição | Consumer | DLQ |
|---|---|---|---|
| `investflow-portfolio-events` | `investflow-investments` | Portfolio Projection | `investflow-portfolio-events-dlq` |

**SNS Message Attributes** — cada mensagem SNS inclui `eventType` como atributo, permitindo filtragem no lado do subscriber se necessário no futuro.

**SNS Envelope Unwrapping** — o SNS encapsula a mensagem ao entregar no SQS. O `SqsConsumerBase` é responsável por unwrap do envelope SNS antes de deserializar o domain event:

```json
// Mensagem recebida na fila SQS (envelope SNS)
{
  "Type": "Notification",
  "MessageId": "uuid",
  "TopicArn": "arn:aws:sns:...:investflow-investments",
  "Message": "{\"eventId\":\"...\",\"eventType\":\"OrderCreatedEvent\", ...}",
  "MessageAttributes": {
    "eventType": { "Type": "String", "Value": "OrderCreatedEvent" }
  }
}
```

**LocalStack** — emula SNS e SQS localmente. Script de init cria tópicos, filas, subscriptions e redrive policies automaticamente no `docker-compose up`.

**Idempotência do Consumer:**

Cada consumer mantém controle de idempotência via tabela `processed_events`:

| Campo | Tipo | Descrição |
|---|---|---|
| event_id | UUID (PK) | ID do evento processado |
| consumer_name | string | Nome do consumer que processou |
| processed_at | timestamptz | Timestamp do processamento |

Antes de processar, o consumer verifica se o `event_id` já existe em `processed_events`. Se sim, descarta a mensagem (deduplicação).

---

## 9. Decisões Arquiteturais

### 9.1 Volume Alocado como Valor Derivado (ADR)

**Contexto:** O volume alocado de um `InvestmentProduct` (quanto do `totalVolume` já foi reservado por Orders) é necessário para validar novas Orders. A modelagem original armazenava `allocatedVolume` como campo do agregado Product, com métodos `reserveVolume()` e `releaseVolume()`.

**Problema:** Isso criava acoplamento transacional — criar uma Order exigia modificar dois agregados (Order + Product) na mesma transação, violando o princípio DDD de "single aggregate per transaction" (Vaughn Vernon).

**Decisão:** `allocatedVolume` é um **valor derivado**, calculado via query:

```sql
SELECT COALESCE(SUM(amount), 0)
FROM orders
WHERE product_id = :productId
  AND status IN ('PENDING', 'ANALYZING', 'APPROVED')
```

**Consequências:**
- **Order.create()** modifica apenas o agregado Order — single aggregate per transaction
- **Volume é sempre consistente** — derivado da fonte de verdade (tabela de Orders)
- **Rejeição/Expiração liberam volume automaticamente** — a transição para estado terminal exclui o amount da query, sem necessidade de `releaseVolume()`
- **Fechamento automático de Product** por volume esgotado é eventual — verificado no use case após criação da Order, em transação separada
- **Race conditions** controladas via isolamento de transação do PostgreSQL (serializable ou SELECT FOR UPDATE nos rows relevantes)
- **Trade-off:** query SUM vs leitura de coluna — negligível com índice adequado

### 9.2 Transactional Outbox Pattern (ADR)

**Contexto:** O sistema precisa publicar domain events no SQS de forma confiável após persistir o estado do agregado.

**Problema:** Publicar diretamente no SQS após o commit cria uma janela de falha — se o publish falhar, o estado foi salvo mas o evento se perdeu. Publicar antes do commit tem o problema inverso.

**Decisão:** Transactional Outbox via `BaseRepository` — toda persistência de agregado automaticamente grava os domain events na tabela `outbox_events` na mesma transação. Nenhum use case precisa saber disso. Um poller assíncrono (`OutboxPollerService`, `@Cron` a cada 5s) lê eventos pendentes, publica no tópico SNS correspondente ao `context` do evento, e marca como publicados. SNS faz fan-out para as SQS queues subscritas.

**Consequências:**
- Garante at-least-once delivery (eventual consistency)
- Consumers devem ser idempotentes (tabela `processed_events`)
- Latência de até 5s entre persistência e publicação (aceitável para o domínio)
- Poller é simples e não requer infraestrutura adicional (CDC, triggers, etc.)
- Use cases ficam limpos — apenas `repo.save(aggregate)`, sem coordenação de eventos
- `BaseRepository` é o único lugar no codebase que chama `getDomainEvents()` / `clearDomainEvents()`

### 9.3 SNS + SQS em vez de SQS direto (ADR)

**Contexto:** O sistema precisa de um mecanismo de mensageria para comunicação assíncrona entre bounded contexts.

**Alternativas consideradas:**
- **SQS direto:** point-to-point, publisher conhece a fila de destino
- **SNS + SQS:** pub/sub, publisher conhece apenas o tópico; subscribers são transparentes
- **EventBridge:** event bus gerenciado com roteamento por conteúdo e schema registry

**Decisão:** SNS + SQS.

**Por que não SQS direto:** O publisher (OutboxPoller no contexto Investments) passaria a conhecer a fila do Portfolio — acoplamento direto entre bounded contexts, exatamente o que EDA evita. Adicionar um novo consumer exigiria mudança no Investments.

**Por que não EventBridge:** Complexidade desproporcional. O projeto tem um conjunto pequeno e conhecido de consumers. Content-based routing não é necessário — consumers filtram por `event_type` no payload. EventBridge desviaria foco da arquitetura DDD/EDA para configuração AWS.

**Consequências:**
- Publisher conhece apenas o tópico SNS do seu próprio contexto — zero acoplamento com consumers
- Adicionar novo consumer = criar SQS queue + subscription no SNS, zero mudanças no publisher
- `SqsConsumerBase` deve fazer unwrap do envelope SNS antes de processar
- `outbox_events` precisa do campo `context` para o poller determinar o tópico SNS correto
- LocalStack emula SNS + SQS localmente com fidelidade suficiente para desenvolvimento

---

## 10. Requisitos Não Funcionais

### 10.1 Resiliência

| Mecanismo | Implementação | Propósito |
|---|---|---|
| Retry | Exponential backoff no consumer SQS | Tolerar falhas transientes |
| Dead Letter Queue (DLQ) | Fila SQS dedicada por consumer (ex: `investflow-portfolio-events-dlq`) | Isolar mensagens problemáticas sem bloquear a fila principal |
| Idempotência | Controle por `eventId` (tabela `processed_events`) | Evitar processamento duplicado |
| Transactional Outbox | Tabela `outbox_events` + publisher | Consistência estado/evento |
| Order Timeout | Scheduler + `expiresAt` | Transitar orders abandonadas para estado terminal (volume derivado automaticamente recalculado) |

### 10.2 Observabilidade

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

### 10.3 Segurança

- Validação de JWT em todas as requisições (Guard NestJS)
- Autorização baseada em roles via decorators customizados
- Isolamento por `organizationId` em todas as queries (WHERE clause)
- Rate limiting nas APIs públicas

---

## 11. Multi-Tenancy

Isolamento lógico por `organizationId`. Sem isolamento físico de banco (intencional para simplificar a infra). Todas as queries são filtradas pelo escopo extraído do JWT.

> **Regra Fundamental:** Nenhuma query ao banco de dados deve ser executada sem filtro de escopo (`userId` para INVESTOR, `organizationId` para ORG_USER). Isso é garantido na camada de repository.

---

## 12. Limitações Intencionais

- Sem conexão com mercado real (taxas via Lambda + seed)
- Sem marcação a mercado complexa (MtM simplificado)
- Sem múltiplos indexadores avançados (apenas SELIC, CDI, IPCA)
- Sem liquidez ou resgate antecipado complexo
- Sem CQRS completo (read model apenas para Portfolio)
- Serviço de análise de risco é mockado (simula latência e decisão)

---

## 13. Roadmap

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

## 14. Critérios de Sucesso

- Usuário autenticado opera dentro do seu escopo sem vazamento de dados
- Organizações isoladas corretamente em todas as operações
- Produtos são gerenciados pelo ORG_USER e consumidos pelo INVESTOR
- Orders passam por dupla validação (síncrona + assíncrona) com volume verificado via query derivada
- Applications evoluem de estado corretamente (state machine validada)
- Volume do Product é consistente — derivado da soma de Orders em estados não-terminais, sem estado mutável no agregado
- Eventos dirigem o processamento end-to-end (EDA visível)
- Sistema observável e testável sob carga
- Modelagem DDD coerente com bounded contexts bem definidos
