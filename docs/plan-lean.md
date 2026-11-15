> Current plan (15 Nov 2026): the lean prototype that replaced Modules 7–13 of `docs/plan-original.md`. Progress is tracked in `docs/PROGRESS.md`.

# PetJet — lean prototype plan (replaces Modules 7–13)

## Context

Modules 0–6 are built and tested: design system, auth and roles, public pages, rules engine, pets and questionnaire, dashboard/checklist/timeline, and documents with extraction. PetJet is now for a **6-minute presentation**, so the rest only needs to be a working prototype that touches every remaining feature: vets, vet portal, lab, flights, pricing and insurance, notifications, and a ready-to-run demo. It should not be built to full depth.

The original Modules 7–13 become **3 lean batches**. Each batch ends with unit tests for its new logic, typecheck, lint and build, then a pause with screenshots. A single end-to-end browser test of the whole demo journey comes in Batch C. The existing 134 browser tests must stay green.

**Your decisions**

| Area | Decision |
|---|---|
| Testing and pauses | Lean checks: unit tests for new logic, plus one full-journey browser test; pause after each of the 3 batches |
| Vets, vet portal, lab | One lean flow: owner → vet → lab |
| Commercial | Simulated upgrade that unlocks **flight booking**; one static insurance page of sample offers |
| Extras | **Notifications only**. Concierge chat and calendar export are dropped |
| Airlines | **Real logo images** (I'll ask before downloading, naming the source and the files) |
| Demo data | Seeded **mid-journey**, with a reset command |
| Switching roles | One-click **demo switcher** bar |

**Dropped from the original plan:** concierge chat, .ics calendar export, settings page (consent and delete data), audit log, decline-and-offer-another-slot flows, a separate full accessibility pass, and per-module browser tests.

## Batch A — Vets, vet portal, lab (one flow)

**Data** (`prisma/schema.prisma`)
- `Provider`: add `services` (JSON list of `VetService` values from `src/lib/rules/types.ts`) and `officialVet`.
- `Appointment`: owner, pet, trip, provider, `service`, `slot` (date and time), status `REQUESTED | ACCEPTED | COMPLETED | DECLINED`.
- `AppointmentDocument`: owner consent to share specific documents.
- `LabOrder`: appointment, pet, lab provider, test `RABIES_TITRE | HEALTH_SCREEN`, status `ORDERED | RESULTED`, result value and note. Results are labelled as samples.
- Seed: the existing demo vet and lab (`prisma/demo-accounts.ts`), plus about 3 extra vet practices for the directory. They are login-less user rows, needed because `Provider.userId` is required.

**Owner side**
- `/app/vets`: a directory filtered by the service a step needs. Checklist steps with a `service` get a "Find a vet" link (same pattern as the upload links in `src/components/trips/pet-plan.tsx`).
- Requesting a slot: three simulated slots inside the step's date window, then tick which documents to share (consent text). "Your appointments" lists their status.

**Vet portal** (`/provider`, replacing the placeholder in `src/app/provider/(portal)/page.tsx`)
- Request inbox and an Accept button.
- Appointment page: pet and trip summary (reuse `planStoredTrip`), and the shared documents.
- "Issue demo certificate" or "Record treatment" writes a `TaskRecord` with source `VET`, so the owner's step completes. Reuse the `taskRecord` upsert pattern from `src/lib/documents/repository.ts`.
- "Order lab test" button.

**File access for vets:** a `/provider/documents/[id]/file` route serves a document only if it is shared on one of that vet's appointments. Otherwise it returns 404, using the same response as `src/app/app/documents/[id]/file/route.ts`.

**Lab portal:** a queue of orders and an "Enter result" form (titre IU/mL; ≥ 0.5 passes). The result shows on the owner's trip page and on the vet's appointment page.

**Navigation:** trim the `NAV` in `src/components/shell/app-shell.tsx` to pages that exist. Vet gets Requests and Notifications; lab gets Test orders; owner loses Settings.

**Tests:** unit tests for slot generation, the share check (a vet can't open an unshared document), the certificate completing the owner's task, and the lab result reaching the owner.

## Batch B — Flights, upgrade, insurance

**Airlines and flights** (`src/lib/flights/`)
- Pet policy summaries for about 4 real airlines on these routes (e.g. Air France, British Airways, Aer Lingus, Virgin Atlantic), labelled "summary — check with the airline".
- A deterministic schedule generator for each route and date.
- Logos go in `public/airlines/`; I'll ask first.

**Eligibility** (pure, unit tested): cabin weight limit including the carrier (uses `Pet.weightKg`), species, snub-nosed breeds in the hold, cabin vs hold. Pets arriving into Great Britain must fly as cargo, matching rule `GB-ENTRY-APPROVED-ROUTE`.

**Search and booking**
- `/app/flights`: search for the trip's route and date, with a per-flight eligibility explanation.
- Booking is simulated and creates a `Booking`. Booking sets the trip's airports. A return flight booked in the hold records `approvedRouteBooked`.
- The e-ticket reuses `src/components/ui/e-ticket.tsx` on the booking page and a dashboard card.

**Upgrade**
- `User.plan`: `EXPLORE | PLAN | COMPLETE`.
- Booking needs `COMPLETE`. Gating is a pure helper with unit tests.
- `/app/upgrade` reuses `TIERS` from `src/lib/marketing/pricing.ts` with a "Pay £39 (simulated)" button. No card fields.

**Insurance:** a static `/app/insurance` page of 3 illustrative offer cards, tailored to the trip's destination and species, each with a sample badge.

## Batch C — Notifications, demo setup, full-journey test

**Notifications**
- A `Notification` model, written when events happen: request, accept, certificate, lab order, lab result, booking.
- Deadlines due within 7 days are worked out when the page loads (no background job).
- `/app/notifications` and `/provider/notifications` pages, with "mark all read". The bell's `unread` prop already exists on `AppShell`.

**Demo switcher:** a slim bar shown only to demo accounts while `DEMO_MODE` isn't `false`. A server action switches between the owner, vet and lab demo accounts using `createSession` from `src/lib/auth/session.ts`. It only allows switching from one demo account to another.

**Demo seed:** `npm run db:demo` resets the demo owner to mid-journey, with dates relative to today:
- Bella, a Cockapoo of about 9 kg (so the hold-vs-cabin eligibility story shows).
- A trip from Great Britain to France in about 6 weeks, with a return.
- A rabies record confirmed, and a microchip certificate waiting for review.
- The account on the Travel Plan, so the upgrade can be shown.
- Clean vet and lab queues.

**README:** setup, demo logins, the reset command, and a 6-minute demo script.

**Full-journey browser test** (`tests/e2e/demo-journey.spec.ts`), desktop and mobile:
1. Owner reviews the microchip certificate.
2. Requests a vet for the health certificate and shares records.
3. Switch to the vet: accept, issue the certificate, order a titre test.
4. Switch to the lab: post the result.
5. Switch to the owner: sees the result and notifications.
6. Upgrades, books flights and sees the e-ticket; readiness reaches 100%.

## Verification (each batch)

- `npm test` for unit tests, including the new ones.
- `npm run typecheck`, `npm run lint`, `npm run build` (clean).
- `npx playwright test` stays green, including the new journey test in Batch C.
- Walk through the batch's screens in the browser pane, then send desktop and mobile screenshots and pause.
- Final: `npm run db:demo`, then rehearse the 6-minute script in the browser pane.
