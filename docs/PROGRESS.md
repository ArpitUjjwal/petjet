# PetJet — build progress

PetJet turns international pet travel rules into a dated plan and connects owners with vets, labs and airlines. It is being built as a working prototype for a **6-minute presentation**. Everything simulated (AI reading, vet certificates, lab results, flights, payments, insurance offers) is labelled as a sample in the app.

_Last updated: 15 Nov 2026_

## Status at a glance

| Stage | What it covers | Status |
|---|---|---|
| Module 0 | Foundation, design system, component showcase (`/design`) | ✅ Done |
| Module 1 | Auth and roles: owner sign-up/login, provider login, route guards, demo accounts | ✅ Done |
| Module 2 | Landing page and public pages | ✅ Done |
| Module 3 | Verified rules database and rules engine (GB → France, Ireland, USA) | ✅ Done |
| Module 4 | My pets and the trip questionnaire, including unsupported-route branches | ✅ Done |
| Module 5 | Bento dashboard, checklist, timeline, trip switcher, edit dates with live preview | ✅ Done |
| Module 6 | Documents: upload, vault, PDF reading with evidence, review and confirm | ✅ Done |
| Batch A | Vet directory and booking, vet portal, lab portal, record sharing | ✅ Done |
| Batch B | Flights with pet eligibility, simulated upgrade gating booking, e-ticket, insurance | ✅ Done |
| Batch C | Notifications, demo switcher, mid-journey demo seed, README, full-journey test | ✅ Done |

The original Modules 7–13 were folded into Batches A–C on 15 Nov 2026 to keep the prototype lean.

**Dropped for the demo:** concierge chat, calendar (.ics) export, settings page (consent and data deletion), audit log, alternative-slot negotiation, a separate full accessibility pass, and per-module browser tests.

## Test status

| Check | Latest result |
|---|---|
| Unit tests (Vitest) | 248 passing |
| Browser tests (Playwright, desktop + mobile) | 142 passing |
| Typecheck and lint | Clean |
| Production build | Clean, no warnings |

## Batch B checklist ✅

- [x] Airline logos: Air France, British Airways, Aer Lingus, Virgin Atlantic from Wikimedia Commons (public domain there) in `public/airlines/`
- [x] `User.plan` and `Booking` data
- [x] Flight schedules and airline pet policies, labelled as summaries (`src/lib/flights/core.ts`)
- [x] Pet eligibility: cabin weight with bag, species, snub-nosed breeds, cargo-only into Great Britain
- [x] Flight search (`/app/flights`) with a per-pet explanation on every flight
- [x] Simulated upgrade (`/app/upgrade`, no card details) that unlocks booking
- [x] Booking and boarding-pass e-ticket (`/app/flights/[id]`); the outbound booking sets the trip's airports, and a cargo flight home ticks off the approved-route step
- [x] Dashboard flights tile, and "Booked with …" on checklist steps a booking completes
- [x] Insurance page (`/app/insurance`) with illustrative offers from made-up insurers
- [x] 15 unit tests and a browser test for the whole flight flow; full suite green; screenshots in `docs/screenshots/batch-b/`

## Batch C checklist ✅

- [x] Notifications behind the bell (`Notification` model, `src/lib/notifications/`): request, accept/decline, certificate, lab order, lab result and booking, each written in the same transaction as its event; deadline reminders (due within 7 days or overdue) worked out on page load; `/app/notifications` and `/provider/notifications` with "Mark all read"
- [x] One-click demo bar between owner, vet and lab, only for demo accounts and off when `DEMO_MODE=false`
- [x] `npm run db:demo`: Bella the Cockapoo, GB → France in **8 days** with a return a week later (changed from ~6 weeks so the vet can issue the certificate on demo day), rabies confirmed, microchip certificate to review
- [x] README with the reset command and a 6-minute demo script
- [x] Full-journey browser test (`tests/e2e/demo-journey.spec.ts`): owner → vet → lab → notifications → upgrade → flights → "ready to fly" at 6 of 7 (only the return tapeworm dose, which can't be given before the trip); plus a demo-bar test; 12 new unit tests; screenshots in `docs/screenshots/batch-c/`

## Where things are

- Plans: `docs/plan-lean.md` (current) and `docs/plan-original.md` (Modules 0–6)
- Screenshots: `docs/screenshots/<module or batch>/` (not in git; browser tests write them to `test-results/`)
- Sample documents: `public/samples/` (regenerate with `npm run samples`)
- Demo accounts: `prisma/demo-accounts.ts` (password `PetJet-demo-2026`)
