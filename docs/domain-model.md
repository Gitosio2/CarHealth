# Domain Model

What CarHealth stores and why. This describes the domain, not the database: table layout,
keys and indexes are decided when the Drizzle schema is written.

Entities are grouped by the bounded context that owns them
([module boundaries](architecture/module-boundaries.md)).

---

## identity

### Profile

The local representation of a person. Credentials never live here — authentication is
delegated ([ADR 0007](architecture/decisions/0007-managed-authentication-provider.md)),
and `Profile` links to the external identity through the token's subject claim.

| Field | Notes |
|---|---|
| `id` | |
| `authSubject` | The `sub` claim from the auth provider. The only link outward |
| `createdAt` | |

Everything a user owns hangs off `Profile`.

---

## vehicles

### Vehicle

| Field | Notes |
|---|---|
| `id` | |
| `profileId` | Owner |
| `make` | |
| `model` | |
| `plate` | Unique **per profile**, not globally |
| `vin` | Optional |
| `createdAt` | |

**`plate` is unique per profile, not globally.** Global uniqueness would let the first
person to register a plate block it permanently, and cars get sold. Two profiles holding
the same plate is normal — a car changed hands, or a couple both track the family car.

**`vin` is optional.** Plenty of owners do not have it to hand, and requiring it would
block registration for no gain.

#### Filling make and model automatically

Verified 2026-08-30:

- **VIN decoding is available.** [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) is free,
  needs no API key and no registration, and offers both VIN decoding and make/model
  listings. It covers vehicles sold in the US from model year 1981, so **European-market
  models decode poorly or not at all.**
- **Plate lookup is not available.** No free public API exists for Spanish plates. The
  DGT provides a web form and charges 8,67 € for the full report; sites advertising a
  free lookup are lead capture, not an API with terms to build on.

Consequence for the design: **make and model must always be typeable by hand, with the
API as an assist that prefills when it succeeds.** Making the lookup a hard dependency
would make a car vPIC does not recognise impossible to register.

### OdometerReading

| Field | Notes |
|---|---|
| `id` | |
| `vehicleId` | |
| `kilometers` | |
| `recordedAt` | |
| `source` | `manual` or `maintenance` |
| `maintenanceId` | Set when `source` is `maintenance` |

**Current mileage is not a field on `Vehicle`.** It is the most recent reading. A vehicle
shows the latest value; earlier readings stay as history, which is what makes it possible
to estimate usage and, later, to project when a distance-based service falls due.

**Readings can be recorded on their own**, without an accompanying maintenance. Required
for reminders to mean anything: if mileage only moved when a maintenance was logged, it
would sit frozen between workshop visits — exactly when a warning is useful.

**A reading lower than the previous one is accepted, with a warning.** The common case is
a typo, and rejecting it outright traps someone who typed `150000` instead of `15000`.
Cluster replacement and imported vehicles are legitimate too. The app flags it and lets
the person decide.

---

## maintenance

A maintenance is a **visit**: one event, at one point in time and mileage. It contains
the work performed, and the work consumes parts.

Keeping those separate is the point. *Changing the oil filter* is the work; *the filter
itself, reference and price* is the material.

```
Maintenance
  └─ Task          the work performed
       └─ Part     what that work consumed
```

### Maintenance

| Field | Notes |
|---|---|
| `id` | |
| `vehicleId` | |
| `performedAt` | |
| `odometerKm` | Creates an `OdometerReading` with `source = maintenance` |
| `notes` | Optional |
| `performedBy` | `self` or `workshop` |
| `workshopId` | Set when `performedBy` is `workshop` |
| `totalCost` | Optional |

### Task

| Field | Notes |
|---|---|
| `id` | |
| `maintenanceId` | |
| `taskType` | Reference to the catalog |
| `notes` | Optional |

### Part

| Field | Notes |
|---|---|
| `id` | |
| `taskId` | Belongs to the task, not to the maintenance |
| `name` | |
| `partNumber` | Optional |
| `quantity` | |
| `unitPrice` | Optional |

Parts hang off the **task**, so the oil filter is tied to *oil filter change* and the
person can see which reference they fitted last time.

### TaskType — a catalog, not free text

| Field | Notes |
|---|---|
| `id` | |
| `name` | Oil change, air filter, spark plugs, timing belt… |
| `intervalKm` | Default, optional |
| `intervalMonths` | Default, optional |

**This is the load-bearing decision of the whole model.** If the task were free text,
the same job becomes "cambio de aceite", "cambio aceite" and "Cambio de Aceite" — three
values that cannot be grouped. Reminders would be impossible: there is no way to say
"due every 15,000 km" about text you cannot match. Reminders are why the application
exists, so the catalog is not negotiable.

### Workshop

| Field | Notes |
|---|---|
| `id` | |
| `profileId` | |
| `name` | |

A light entity, created on the fly by typing a name — no separate management screen. It
exists so history groups ("what has this workshop done for me") without adding work for
the user.

### Cost: a total, with an optional breakdown

`Maintenance.totalCost` is always available; `Part.unitPrice` is optional.

This covers both real situations: a workshop invoice that says `320 €` and details
nothing, and DIY work where the part prices are known exactly. Requiring a breakdown
would mean itemising invoices that cannot be itemised, and the predictable result is
people stop recording costs at all.

When a breakdown exists and does not add up to the total, **the app flags the
discrepancy rather than silently picking one**. Both numbers can be legitimate — labour
is not a part — so the person decides.

---

## reminders

### Reminders are derived, never stored

There is no reminders table. A reminder is computed when it is read.

Storing them would mean recalculating rows on every maintenance and every odometer
reading, and any row that drifts out of sync produces a wrong alert — silently. Deriving
them leaves nothing to keep in sync and cannot go stale. At the scale of one person with
a few vehicles, the computation cost is irrelevant.

```
next due = last time the task was done + interval
```

"Last time" comes from real `Task` history, falling back to the schedule's baseline when
there is none.

**Distance and time combine as whichever comes first.** Oil at 15,000 km or 12 months
falls due on whichever is reached sooner.

Derived status: `on-time`, `due-soon`, `overdue`.

### VehicleTaskSchedule

| Field | Notes |
|---|---|
| `id` | |
| `vehicleId` | |
| `taskType` | |
| `intervalKm` | Optional. Overrides the catalog default |
| `intervalMonths` | Optional. Overrides the catalog default |
| `baselineDate` | Optional. "Last done" when there is no history |
| `baselineKm` | Optional |

One entity, three jobs:

1. **Which** catalog tasks to follow on this vehicle. Nobody wants alerts for all forty.
2. **Overriding the interval** — the car's own manual outranks a generic default.
3. **A starting point** when the task has never been logged.

The baseline exists because registering an eight-year-old car should produce useful
reminders on day one, not after the next workshop visit. It can be set without logging a
full maintenance.

Counting from the vehicle's registration date instead was rejected: it silently assumes
everything was up to date, so a car 20,000 km overdue for an oil change would display as
fine. A wrong reminder is worse than no reminder, because it is trusted.

---

## Open questions

| Question | Why it is still open |
|---|---|
| How reminders are delivered — push, email, or an in-app list only | iOS PWA web push has real constraints that need verifying first ([ADR 0006](architecture/decisions/0006-pwa-first-mobile-strategy.md)) |
| Who seeds the `TaskType` catalog, and whether users can extend it | Depends on how many task types the first version actually needs |
| Whether a vehicle can belong to more than one profile | Not needed for the first version; the model does not preclude it |
