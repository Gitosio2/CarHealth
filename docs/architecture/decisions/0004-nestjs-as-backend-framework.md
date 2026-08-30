# 0004. NestJS as the backend framework

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

With TypeScript chosen ([ADR 0001](0001-typescript-over-java.md)), the backend needs a
framework. The architecture is already fixed: a modular monolith
([ADR 0002](0002-modular-monolith.md)) where each module follows ports and adapters
([ADR 0003](0003-hexagonal-architecture.md)).

Ports and adapters requires dependency injection. Use cases depend on port interfaces,
and something has to supply the concrete adapter at runtime. Module boundaries similarly
need a mechanism that makes a module's public surface explicit and everything else
private.

The framework choice is therefore not about routing or middleware. It is about whether
the framework supports the architecture that has already been decided.

## Decision

**NestJS 11** on Node 22.

## Consequences

### Positive

- Dependency injection is built in and is exactly the mechanism ports and adapters
  needs. Ports are injected by token; adapters are bound in the module definition.
- NestJS modules make a context's public surface explicit — what is exported is public,
  what is not is private — which maps directly onto the bounded-context boundaries.
- The layered structure is idiomatic rather than fought for. The framework encourages
  the separation the architecture requires.
- Strong integrations for the rest of the stack: `nestjs-zod`
  ([ADR 0008](0008-zod-contracts-and-openapi.md)), a first-class testing module, and
  JWT resource-server support ([ADR 0007](0007-managed-authentication-provider.md)).
- Substantial documentation and a stable, slow-moving core — valuable given the Node
  ecosystem churn noted in ADR 0001.

### Negative

- **NestJS requires a Node runtime and does not run on edge runtimes** such as
  Cloudflare Workers. This eliminates a category of free hosting and is recorded
  explicitly in [ADR 0012](0012-free-tier-infrastructure.md).
- Heavier than a minimal framework: more startup cost, more memory, more concepts.
- Decorator-driven and opinionated. The learning curve is real, though much of it maps
  onto patterns already familiar from Spring.
- The framework has strong opinions that will occasionally conflict with the hexagonal
  layering — most visibly the temptation to let decorators leak toward the domain. The
  boundary rules in [ADR 0011](0011-automated-architecture-enforcement.md) exist partly
  to prevent exactly that.

### Neutral

- Familiarity with Spring transfers well. Modules, DI, and layered separation are the
  same ideas with different syntax, which partly offsets the expertise cost accepted in
  ADR 0001.

## Alternatives considered

**Fastify or Express with hand-rolled structure** — lighter, faster, fewer concepts.
Rejected because the architecture needs dependency injection and explicit module
boundaries regardless, so choosing a minimal framework means building those mechanisms by
hand. The likely outcome is a worse reimplementation of what NestJS already provides,
maintained by one person.

**Hono** — excellent runtime characteristics and the one option that would have kept
Cloudflare Workers available, restoring true edge deployment. Rejected for the same
reason as Fastify: no dependency injection and no module system, so the architecture
would have to be built manually. The edge-hosting benefit is real but does not outweigh
having to hand-build the structural foundation. Worth revisiting only if edge deployment
becomes a hard requirement.

**tRPC-first frameworks** — attractive type ergonomics. Rejected along with tRPC itself,
for the client-coupling reason given in
[ADR 0008](0008-zod-contracts-and-openapi.md).
