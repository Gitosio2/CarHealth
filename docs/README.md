# CarHealth Documentation

## Purpose

CarHealth lets a private vehicle owner register the vehicles associated with their
profile and maintain a record of the maintenance performed on each one — services,
costs, and mileage — so that upcoming or overdue work is visible rather than remembered.

## Scope of this documentation

This directory holds architecture, technology and domain decisions. It is written to
answer one question for anyone joining the project: *why is it built this way?*

- [domain-model.md](domain-model.md) — what the application stores and why
- [architecture/README.md](architecture/README.md) — system overview and ADR index
- [architecture/stack.md](architecture/stack.md) — technology reference
- [architecture/module-boundaries.md](architecture/module-boundaries.md) — bounded
  contexts and the rules governing how they interact

## Not documented yet

These are open by design, not by oversight. They are listed in the architecture README
and at the end of the domain model, so they cannot be quietly forgotten:

- Visual design and UI conventions
- The concrete authentication and hosting providers
- Notification delivery
- The CI/CD pipeline
