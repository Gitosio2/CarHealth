# 0001. TypeScript over Java

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

CarHealth needs a backend language. The developer building it has advanced Java
expertise and comparatively less depth in the Node ecosystem.

The initial recommendation was Java 21 + Spring Boot 3, precisely because it maximised
existing expertise. That recommendation was reconsidered when the alternative was
examined: the frontend is already TypeScript, and the project must stay free of cost.

Two facts weighed against Java, and neither is about the language's quality:

**Hosting economics.** A JVM needs meaningful memory to run continuously. On a 512 MB
free tier it fits, but scale-to-zero platforms — the ones that make free hosting
sustainable — impose cold starts measured in tens of seconds for a JVM against roughly a
second for a Node process. Working around this means GraalVM native compilation, which
adds real build complexity and constrains reflection-heavy libraries, or an always-on VM
that must be administered manually.

**Contract duplication.** With Java, an API shape is defined in Java DTOs and then
regenerated as TypeScript types for the frontend. It works, but it is a translation step
that exists only because the two ends speak different languages.

## Decision

The backend is written in **TypeScript on Node 22**. The entire project — backend,
frontend, shared contracts, tests, tooling — uses one language.

This was chosen deliberately over the option that better matched existing expertise.

## Consequences

### Positive

- API shapes are defined once as Zod schemas in `packages/contracts` and consumed
  directly by both applications. No translation step, no generated-code drift.
- One test runner and one assertion syntax across the repository.
- Free hosting becomes straightforward rather than a constraint the architecture must
  work around. GraalVM native compilation, and the always-on VM it would have avoided,
  are both off the table.
- Context switching between backend and frontend work disappears.

### Negative

- **The developer's deepest expertise is set aside.** Early velocity will be lower than
  it would have been with Spring Boot, and mistakes will be made in a less familiar
  ecosystem. This is a real cost, accepted knowingly.
- **The structural pressure the Java ecosystem provides for free is gone.** In Java, the
  compiler, the module system, and ecosystem conventions all push toward structure.
  TypeScript on Node permits an unstructured codebase silently — nothing complains as the
  architecture rots.
- The Node ecosystem churns faster. Libraries chosen today are more likely to need
  replacing than their Java equivalents.
- Runtime type safety is not free. TypeScript types vanish at runtime, so every
  boundary needs explicit validation — which is why Zod is not optional here
  ([ADR 0008](0008-zod-contracts-and-openapi.md)).

### Neutral

- The architecture is unchanged. Hexagonal, modular monolith, and contract-first apply
  identically under either language; only the implementation differs.

## Alternatives considered

**Java 21 + Spring Boot 3** — the strongest fit for the developer's expertise, the more
mature ecosystem, and stronger structural guarantees. Rejected in favour of language
unification, with the hosting friction as a contributing factor. This remains a
defensible choice and would be the right one for a team with Java depth.

**Java 21 + Quarkus** — keeps Java while improving startup time and memory footprint,
with native compilation as a first-class concern. It addresses the hosting objection
directly. Rejected because it solves only that objection while leaving contract
duplication in place, and it trades Spring's ecosystem for a considerably smaller one.

**Go** — the best runtime economics of any option: single binary, tiny memory footprint,
fits any free tier trivially. Rejected because it shares nothing with the frontend and
requires substantially more boilerplate for CRUD, which is most of what this application
does.

## Consequence that must not be lost

Because the structural pressure of the Java ecosystem is gone, it has to be replaced
deliberately. That is the entire justification for
[ADR 0011](0011-automated-architecture-enforcement.md), and the reason architecture
enforcement is mandatory in this project rather than a nice-to-have.
