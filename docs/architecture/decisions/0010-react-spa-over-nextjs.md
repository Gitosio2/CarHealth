# 0010. React SPA over Next.js

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

The frontend is a single React application, installable as a PWA
([ADR 0006](0006-pwa-first-mobile-strategy.md)). The question is whether it is a static
single-page application or a server-rendered framework.

Next.js is the default answer for React applications, so the reasons not to use it need
stating. Two properties of CarHealth make it a poor fit:

**There is no anonymous content.** Every screen requires authentication. There is nothing
for a search engine to index and nothing to render for a first-time visitor beyond a
login screen, so server-side rendering has no audience.

**Server rendering costs money.** SSR requires a running Node process. A static SPA is
files on a CDN, which is free on several platforms indefinitely. The zero-cost constraint
makes this a direct architectural cost, not a preference.

## Decision

**React 19 + TypeScript + Vite**, built as a static single-page application and deployed
to a CDN.

| Concern | Choice |
|---|---|
| Build | Vite 6 |
| Routing | TanStack Router |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod resolver |
| PWA | `vite-plugin-pwa` (Workbox) |

## Consequences

### Positive

- The frontend deploys as static files: free hosting, global CDN distribution, no server
  to operate, monitor, or patch.
- Vite's development experience is fast, and the production bundle carries no framework
  server runtime.
- TanStack Router provides type-safe routes and typed search parameters, which pairs well
  with the contract types from `packages/contracts`
  ([ADR 0008](0008-zod-contracts-and-openapi.md)).
- TanStack Query's caching and revalidation behaviour is a good foundation for the
  offline capability the PWA needs.
- React Hook Form consumes the same Zod schemas the API validates against, so a field's
  rules exist in exactly one place.

### Negative

- No server-side rendering, so first paint waits for the JavaScript bundle. Acceptable
  for an authenticated application; it would not be for a public one.
- No SEO. Correct for this product, and a genuine constraint if CarHealth ever grows a
  public marketing surface — that would be a separate static site, not a change to this
  decision.
- Routing, data fetching, and PWA setup are assembled from separate libraries rather than
  provided by one framework. More initial configuration.

### Neutral

- No dedicated client-state library. TanStack Query owns server state, which is nearly all
  the state this application has. Zustand is added only if a real cross-component
  client-state need appears — adopting a store preemptively creates a place for state
  that should have stayed server state.

## Alternatives considered

**Next.js** — the ecosystem default, with routing, data fetching, and image optimisation
included, and excellent SSR when SSR is needed. Rejected because this application has no
SEO surface to serve and SSR requires a running server, which works directly against the
zero-cost constraint. It would add deployment complexity and runtime cost in exchange for
benefits the product does not consume.

**Remix / React Router framework mode** — similar reasoning to Next.js, with the same
server requirement. Rejected for the same reason. React Router in library mode was a
reasonable alternative to TanStack Router; TanStack Router was preferred for stronger
type inference on routes and search parameters.

**Astro** — outstanding for content-heavy sites with islands of interactivity. Rejected
because CarHealth is the opposite shape: an application that is interactive throughout,
with no content to statically render.
