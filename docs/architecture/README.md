# CarHealth Architecture

## System overview

CarHealth is a single backend service and a single web client, deployed independently.

```
┌──────────────────┐        ┌─────────────────────┐
│  Auth provider   │        │  Browser / Phone    │
│  (managed)       │        │  React PWA          │
└────────┬─────────┘        └──────────┬──────────┘
         │ issues JWT                  │ HTTPS + Bearer JWT
         │                             ▼
         │                  ┌─────────────────────┐
         │  JWKS            │  CarHealth API      │
         └─────────────────▶│  NestJS             │
            (validation)    │  modular monolith   │
                            └──────────┬──────────┘
                                       │ SQL
                                       ▼
                            ┌─────────────────────┐
                            │  PostgreSQL         │
                            └─────────────────────┘
```

Three properties define the design:

**The API is a modular monolith, not microservices.** One deployable unit containing four
bounded contexts — `identity`, `vehicles`, `maintenance`, and `reminders` — with
explicit, enforced boundaries. Extraction into a separate service remains possible later
precisely because those boundaries exist, but nothing is distributed before there is a
reason to distribute it. See [module-boundaries.md](module-boundaries.md) for what each
context owns.

**Every module is hexagonal.** Domain logic has no knowledge of NestJS, of Drizzle, or of
HTTP. Infrastructure depends on the domain; never the reverse.

**The API contract is defined once.** Zod schemas in `packages/contracts` produce
request validation, response validation, both apps' types, and the OpenAPI document.
There is no second place where an API shape is described.

## Repository layout

```
carhealth/
├── apps/
│   ├── api/            → NestJS backend
│   └── web/            → React + Vite PWA
├── packages/
│   ├── contracts/      → Zod schemas + inferred types
│   └── tsconfig/       → shared TypeScript + ESLint configuration
├── pnpm-workspace.yaml
└── turbo.json
```

## Documents

- [stack.md](stack.md) — the technology reference, with versions
- [module-boundaries.md](module-boundaries.md) — bounded contexts, layer rules, and
  where new code belongs
- [domain-model.md](../domain-model.md) — what the application stores and why

## Decision records

Read in order; each states what was rejected and why.

| ADR | Decision |
|---|---|
| [0001](decisions/0001-typescript-over-java.md) | TypeScript over Java |
| [0002](decisions/0002-modular-monolith.md) | Modular monolith over microservices |
| [0003](decisions/0003-hexagonal-architecture.md) | Hexagonal architecture per module |
| [0004](decisions/0004-nestjs-as-backend-framework.md) | NestJS as the backend framework |
| [0005](decisions/0005-pnpm-turborepo-monorepo.md) | Monorepo with pnpm and Turborepo |
| [0006](decisions/0006-pwa-first-mobile-strategy.md) | PWA-first mobile strategy |
| [0007](decisions/0007-managed-authentication-provider.md) | Managed authentication provider |
| [0008](decisions/0008-zod-contracts-and-openapi.md) | Zod contracts surfaced as OpenAPI |
| [0009](decisions/0009-drizzle-and-postgresql.md) | Drizzle ORM and PostgreSQL |
| [0010](decisions/0010-react-spa-over-nextjs.md) | React SPA over Next.js |
| [0011](decisions/0011-automated-architecture-enforcement.md) | Automated architecture enforcement |
| [0012](decisions/0012-free-tier-infrastructure.md) | Free-tier infrastructure |
| [0013](decisions/0013-centralised-physical-schema.md) | The physical schema is a single artefact |

### How ADRs work here

ADRs are **append-only**. A decision that is later reversed does not get edited or
deleted — its status becomes `Superseded by NNNN` and a new ADR is written. The record
of what was believed, and when, is the point.

Every ADR must carry a populated *Alternatives considered* section. An ADR that names
only the winner is a note, not a decision record; the value lies in preventing the same
debate six months from now.

## Open questions

Deliberately undecided. Listed here so they stay visible.

| Question | Why it is deferred |
|---|---|
| Visual design, component library | No UI work has started |
| Concrete auth provider | Interacts with the hosting choice — see ADR 0007 and 0012 |
| Concrete hosting provider | Free-tier terms need re-verification at deploy time |
| Notification delivery | Web push has real iOS PWA constraints requiring investigation |
| CI/CD pipeline | Defined alongside the repository scaffold |
