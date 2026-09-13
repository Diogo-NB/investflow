# Project Structure And File Naming

## Bounded Contexts

- Keep each bounded context under one `libs/<context>/` grouping. The grouping,
  not each nested Nx project, represents the bounded context.
- Split every bounded context into Nx projects by layer:
  - `libs/<context>/domain`
  - `libs/<context>/application`
  - `libs/<context>/infrastructure`
- Keep deployable entrypoints and composition roots under `apps/`.
- Keep genuinely cross-context building blocks in `libs/shared`; shared is not a
  bounded context.
- Contexts communicate through integration events or explicit contracts, never
  direct imports of another context's internals.

## Deployment Layout

- An app selects and imports public bounded-context infrastructure modules.
- Context-local controllers, handlers, repositories, listeners, mappers, and
  provider bindings remain in their owning context.
- Keep process bootstrap, host lifecycle, global middleware, and runtime-specific
  entrypoints in the app.
- Follow `.ai/rules/deployment-composition.md` when adding a service, Lambda,
  worker, or independently activated adapter.

## Folder Layout

Use loose type-first folders inside each layer. Add feature subfolders when a
folder grows.

Domain folders:

- `aggregates/<feature>`
- `entities/<feature>`
- `value-objects/<feature>`
- `events/<feature>`
- `services/<feature>`
- `errors/<feature>`
- `utils`

Application folders:

- `commands/<feature>`
- `queries/<feature>`
- `ports/<feature>`
- `services/<feature>`
- `listeners/<feature>`
- `errors/<feature>`

Infrastructure folders:

- `controllers/<feature>`
- `dtos/<feature>`
- `repositories/<feature>`
- `query-handlers/<feature>`
- `mappers/<feature>`
- `presenters/<feature>`
- `listeners/<feature>`
- `logging`

## File Suffixes

Use kebab-case filenames with these role suffixes:

| Role                   | Suffix                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| Controller             | `*.controller.ts`                                                     |
| Nest module            | `*.module.ts`                                                         |
| Listener or consumer   | `*.listener.ts`                                                       |
| DTO                    | `*.dto.ts`                                                            |
| Guard                  | `*.guard.ts`                                                          |
| Decorator              | `*.decorator.ts`                                                      |
| Filter                 | `*.filter.ts`                                                         |
| Interceptor            | `*.interceptor.ts`                                                    |
| Strategy               | `*.strategy.ts`                                                       |
| Use case               | `*.use-case.ts`                                                       |
| Query handler          | `*.query-handler.ts`                                                  |
| Command                | `*.command.ts`                                                        |
| Query                  | `*.query.ts`                                                          |
| Repository             | `*.repository.ts`                                                     |
| Port                   | `*.port.ts`                                                           |
| Mapper                 | `*.mapper.ts`                                                         |
| Presenter              | `*.presenter.ts`                                                      |
| Aggregate              | `*.aggregate.ts`                                                      |
| Entity                 | `*.entity.ts`                                                         |
| Value object           | `*.vo.ts`                                                             |
| Event                  | `*.event.ts`                                                          |
| Domain service         | `*.domain-service.ts`                                                 |
| Application service    | `*.application-service.ts`                                            |
| Infrastructure service | `*.service.ts`                                                        |
| Error                  | `*.error.ts`                                                          |
| Compile-time contract  | `*.contract.ts`                                                       |
| Type-only declaration  | `*.type.ts`                                                           |
| Base class             | `*.base.ts`                                                           |
| Registry               | `*.registry.ts`                                                       |
| Context                | `*.context.ts`                                                        |
| Test                   | mirror source suffix, for example `create-portfolio.use-case.spec.ts` |

## Public Imports

- Export each library's API from `src/index.ts`.
- Import other libraries through public aliases only.
- Use relative imports only inside the same Nx project.
