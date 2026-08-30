# 0006. PWA-first mobile strategy

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

CarHealth is described as a web/mobile application. A vehicle owner is most likely to
record a service from their phone, standing in a workshop, so the phone experience is not
secondary.

The project must also stay free of cost. That constraint interacts directly with the
mobile decision: Apple's Developer Program costs 99 USD per year unconditionally, and
Google Play charges a 25 USD one-time registration fee. Any strategy that ships to the
App Store ends the zero-cost property permanently, before a single user exists.

## Decision

**Progressive Web App first.** One React application
([ADR 0010](0010-react-spa-over-nextjs.md)) made installable through
`vite-plugin-pwa`, with a service worker providing an offline shell.

No native client is built now. The architecture must not prevent adding one later.

## Consequences

### Positive

- The project stays genuinely free. This is the only mobile option for which that is
  true.
- One codebase, one deployment, one set of tests. No platform-specific build pipeline, no
  store review cycle, no release coordination.
- Updates reach users immediately — no store approval, no fragmented versions in the
  field.
- Installable to the home screen on both Android and iOS, with offline access to the
  application shell.

### Negative

- **iOS constrains PWAs meaningfully.** Web push works on iOS 16.4 and later but only for
  home-screen-installed apps, and background capabilities are limited. Since reminders
  are a core feature of this product, this is a genuine functional risk and is recorded
  as an open question in [the architecture README](../README.md) — it needs
  investigation before the reminder feature is designed, not after.
- No native hardware integration. Any future OBD-II or Bluetooth work would require a
  native client.
- No app store presence, which affects discoverability if the project ever seeks users
  beyond its author.
- Installation is less discoverable than a store listing; users must be told it is
  possible.

### Neutral

- Adding a native client later is not blocked. The API is contract-first and emits
  OpenAPI ([ADR 0008](0008-zod-contracts-and-openapi.md)), so a second client consumes
  the same contract with no backend change. That is the specific reason tRPC was
  rejected there.

## Alternatives considered

**React Native + Expo from the start** — a real app in the stores, native push without
caveats, and access to camera and Bluetooth. Code sharing with the web client would be
possible through the monorepo. Rejected because it breaks the zero-cost constraint
immediately and adds a second build pipeline, a store review cycle, and platform-specific
bugs before the domain itself has been built. It remains the natural next step if the
iOS push limitation proves blocking.

**Flutter** — excellent mobile results and a single mobile codebase. Rejected because
Dart shares nothing with the web stack: it would mean two frontends with no common code,
no shared contracts, and no reuse of the Zod schemas — while also breaking the zero-cost
constraint.

**Web-only, no PWA** — simpler still. Rejected because the offline shell and home-screen
installation cost almost nothing with `vite-plugin-pwa` and materially improve the phone
experience, which is the primary usage context.
