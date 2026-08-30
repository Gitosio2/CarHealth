# Technology Stack

Each entry links to the decision record holding the full reasoning. Versions are the
targets at the time of writing; they are updated as the project moves.

## Backend — `apps/api`

| Concern | Choice | Version | Reference |
|---|---|---|---|
| Language | TypeScript | 5.x | [ADR 0001](decisions/0001-typescript-over-java.md) |
| Runtime | Node | 24 LTS | [ADR 0001](decisions/0001-typescript-over-java.md) |
| Framework | NestJS | 12.x | [ADR 0004](decisions/0004-nestjs-as-backend-framework.md) |
| Architecture | Modular monolith, hexagonal | — | [ADR 0002](decisions/0002-modular-monolith.md), [ADR 0003](decisions/0003-hexagonal-architecture.md) |
| Database | PostgreSQL | 16+ | [ADR 0009](decisions/0009-drizzle-and-postgresql.md) |
| ORM | Drizzle ORM | latest | [ADR 0009](decisions/0009-drizzle-and-postgresql.md) |
| Migrations | drizzle-kit | latest | [ADR 0009](decisions/0009-drizzle-and-postgresql.md) |
| Validation | Zod | 4.x | [ADR 0008](decisions/0008-zod-contracts-and-openapi.md) |
| API documentation | `nestjs-zod` v5 → OpenAPI | 5.x | [ADR 0008](decisions/0008-zod-contracts-and-openapi.md) |
| Authentication | JWT resource server | — | [ADR 0007](decisions/0007-managed-authentication-provider.md) |

## Frontend — `apps/web`

| Concern | Choice | Version | Reference |
|---|---|---|---|
| Framework | React | 19.x | [ADR 0010](decisions/0010-react-spa-over-nextjs.md) |
| Build tool | Vite | 6.x | [ADR 0010](decisions/0010-react-spa-over-nextjs.md) |
| Routing | TanStack Router | 1.x | [ADR 0010](decisions/0010-react-spa-over-nextjs.md) |
| Server state | TanStack Query | 5.x | [ADR 0010](decisions/0010-react-spa-over-nextjs.md) |
| Forms | React Hook Form + Zod resolver | 7.x | [ADR 0008](decisions/0008-zod-contracts-and-openapi.md) |
| PWA | `vite-plugin-pwa` (Workbox) | latest | [ADR 0006](decisions/0006-pwa-first-mobile-strategy.md) |

Client state deliberately has no dedicated library. TanStack Query owns server state,
which is the overwhelming majority of state in this application. A store such as Zustand
is added only when a genuine cross-component client-state need appears — not in advance.

## Shared — `packages/contracts`

Zod schemas and the types inferred from them. Both applications depend on this package;
neither defines an API shape independently. See
[ADR 0008](decisions/0008-zod-contracts-and-openapi.md).

## Repository

| Concern | Choice | Reference |
|---|---|---|
| Package manager | pnpm 11 | [ADR 0005](decisions/0005-pnpm-turborepo-monorepo.md) |
| Workspace orchestration | Turborepo 2 | [ADR 0005](decisions/0005-pnpm-turborepo-monorepo.md) |

## Testing

Strict TDD applies: tests are written before the implementation they describe.

| Layer | Tools |
|---|---|
| Backend unit | Vitest |
| Backend integration | Testcontainers (PostgreSQL) + NestJS testing module |
| Backend API | Supertest |
| Architecture | `dependency-cruiser` 17 — see [ADR 0011](decisions/0011-automated-architecture-enforcement.md) |
| Frontend unit | Vitest + Testing Library |
| Frontend API mocking | MSW, typed from `packages/contracts` |
| End-to-end | Playwright |

Integration tests run against real PostgreSQL via Testcontainers. SQLite and in-memory
substitutes are rejected: they accept SQL that PostgreSQL rejects and vice versa, which
produces the green-locally / red-in-production failure mode.

One test runner and one assertion syntax across the entire repository is a direct,
concrete benefit of the single-language decision in ADR 0001.

## Infrastructure

Provider selection is deferred; see
[ADR 0012](decisions/0012-free-tier-infrastructure.md) for the evaluated options, their
verification dates, and the caveats that matter.

Current recommendation: API on Google Cloud Run or Render, PostgreSQL on Neon, web app on
Cloudflare Pages, with Oracle Cloud Always Free documented as the fallback.

## Not part of the stack

Recorded so they are not re-proposed without new information:

| Rejected | Reason | Reference |
|---|---|---|
| Java + Spring Boot | Language unification chosen over existing expertise | [ADR 0001](decisions/0001-typescript-over-java.md) |
| Microservices | No problem at this scale that they solve | [ADR 0002](decisions/0002-modular-monolith.md) |
| Next.js | No SEO surface; SSR adds server cost against the free constraint | [ADR 0010](decisions/0010-react-spa-over-nextjs.md) |
| tRPC | Couples every client to TypeScript | [ADR 0008](decisions/0008-zod-contracts-and-openapi.md) |
| Prisma | Codegen step and larger runtime footprint | [ADR 0009](decisions/0009-drizzle-and-postgresql.md) |
| React Native / Flutter | Breaks the zero-cost constraint; PWA first | [ADR 0006](decisions/0006-pwa-first-mobile-strategy.md) |
| Self-managed authentication | Largest avoidable security surface | [ADR 0007](decisions/0007-managed-authentication-provider.md) |
| Cloudflare Workers | NestJS requires a Node runtime | [ADR 0012](decisions/0012-free-tier-infrastructure.md) |
