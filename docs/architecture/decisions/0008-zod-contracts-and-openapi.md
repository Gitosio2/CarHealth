# 0008. Zod contracts surfaced as OpenAPI

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

An API shape is normally described in several places at once: a validation schema, a
backend type, a frontend type, and the API documentation. Each is written by hand, and
each drifts from the others. Documentation drifts first and fastest, because nothing
fails when it is wrong.

TypeScript makes this worse in one specific way: types are erased at runtime. A typed
response is a claim, not a guarantee — if the backend returns something else, the
frontend discovers it as an undefined property in production, not as a compile error.

The monorepo ([ADR 0005](0005-pnpm-turborepo-monorepo.md)) makes a single shared
definition mechanically possible. This decision is about what that definition is.

## Decision

API shapes are defined **once, as Zod schemas, in `packages/contracts`**, and surfaced
through **`nestjs-zod` v5**.

Each schema drives four things:

1. Runtime request validation in NestJS
2. Runtime response validation, via `ZodResponse`
3. Compile-time types in both applications, via `z.infer`
4. The generated OpenAPI document

`nestjs-zod` v5 supports Zod 4 and is explicitly designed to keep the run-time,
compile-time, and documentation representations in sync — verified August 2026.

## Consequences

### Positive

- One definition per API shape. Documentation cannot drift, because it is generated from
  the thing that validates.
- Runtime validation at both boundaries closes the type-erasure gap identified in
  [ADR 0001](0001-typescript-over-java.md). Malformed data is rejected where it enters,
  not discovered three layers deeper.
- The frontend imports the same schemas for form validation via the React Hook Form Zod
  resolver, so a field's rules are stated once and enforced on both sides.
- MSW mocks in frontend tests are typed from the contract, so a mock cannot describe a
  response the API could never produce.
- A breaking contract change fails compilation in the same commit that introduces it.

### Negative

- Zod validation has a runtime cost on every request. Irrelevant at this scale, worth
  knowing.
- `packages/contracts` becomes a dependency of everything, so a careless change there has
  wide reach. Mitigated by that change failing loudly at compile time.
- Coupling to `nestjs-zod` for OpenAPI generation. The Zod schemas themselves are
  portable; the NestJS integration is not.

### Neutral

- Contract-first is what keeps [ADR 0006](0006-pwa-first-mobile-strategy.md)'s promise
  real: a future native client consumes the same OpenAPI document with no backend change.

## Alternatives considered

**tRPC** — end-to-end type safety with no code generation and no OpenAPI document, and
the best developer experience of the options. **Rejected because it couples every client
to TypeScript.** A future non-TypeScript client, or any third-party consumer, would have
nothing to consume. Since "add a native client later" is an explicit goal
([ADR 0006](0006-pwa-first-mobile-strategy.md)), the OpenAPI document is what keeps that
door open, and it costs very little to emit.

**`ts-rest`** — genuinely good: contract-first, end-to-end types, first-class NestJS
support, and OpenAPI generation via `@ts-rest/open-api`. Rejected only because
`nestjs-zod` already covers the requirement without adding a dependency. Worth revisiting
if contract-first routing becomes a stronger need.

**OpenAPI-first with generated TypeScript clients** — the conventional approach, and
language-agnostic. Rejected because it reintroduces a code generation step and a build
artefact that can be stale, in exchange for portability the Zod-to-OpenAPI direction
already provides.

**`class-validator` DTOs, the NestJS default** — idiomatic and well supported. Rejected
because the DTOs are backend classes that the frontend cannot import, so frontend types
would be written separately. That is precisely the duplication this decision exists to
remove.
