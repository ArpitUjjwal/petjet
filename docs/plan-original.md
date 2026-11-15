> Original plan (14 Nov 2026). Modules 0–6 were built from it; Modules 7–13 were replaced by the lean plan in `docs/plan-lean.md`.

# PetJet — build plan

## Context

PetJet is a pet travel assistance platform (Gillmore Hackathon 2026 blueprint) that turns international pet travel rules into a personalised, dated plan and connects owners with vets, pathologists/labs and partner airlines. The project started empty, so this is a from-scratch build. The goal is a complete, working product that runs locally with one command, built as independent modules, each finished and tested before the next starts.

## Decisions made with you

| Area | Decision |
|---|---|
| Backend | Local-first: Next.js + SQLite, no external accounts |
| AI | Simulated, no API calls. Document reading is real local PDF text parsing + pattern matching; concierge is retrieval over verified rules with source-linked answers |
| Routes | Great Britain → France, → Ireland, → USA (with return to GB). Everything else gets "unsupported route" guidance |
| Travel mode | Air only |
| Logins | Customer (sign-up + login) and Provider (vet or pathologist; pre-seeded accounts only) |
| Pathologist | Lab workflow with optional tests (rabies titre, pre-travel health screen) |
| Airlines | No airline login. Seeded realistic schedules for real airlines with real logos; search, simulated booking, boarding-pass style e-ticket for owner + pet |
| Vet portal | Appointment requests, shared-document review, record treatments + demo certificate, order lab tests |
| Commercial | Pricing tiers + simulated checkout, insurance page, reminders + .ics export, multiple pets and trips |
| Design | "Modern product": all-sans geometric type, crisp cards, bento-grid dashboard; sage green / cream / warm tan from your logo; refined motion |
| Testing | Vitest unit/integration + Playwright browser tests per module; all earlier modules' tests must still pass |
| Checkpoints | I pause after every module with test results and screenshots and wait for your go-ahead |

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS · Prisma + SQLite · email/password auth with signed HTTP-only session cookie and roles (`OWNER`, `VET`, `LAB`) · uploads in `storage/uploads/` served through an authorised route · `pdfjs-dist` for PDF text · Framer Motion for transitions · Vitest + Playwright.

## Design system (premium bar)

- Tokens in one place (`src/styles/tokens.css` + Tailwind theme): deep forest green primary, sage tints, cream surfaces, warm tan accent, ink text; 8-pt spacing; two radii; layered soft shadows; hairline borders.
- Type: one geometric sans (Geist or similar) with tight display sizes for headlines, tabular numerals for dates and counts.
- Component library in `src/components/ui/`: button, input, select, stepper, card, badge/status pill, progress ring, timeline, table, dialog, drawer, toast, skeleton, empty state, e-ticket.
- Motion: page and step transitions, animated progress ring and timeline, hover/press states, skeleton loaders, boarding-pass reveal; honours reduced-motion.
- Every screen designed for desktop and mobile, with real empty, loading and error states. Keyboard focus and contrast checked.

## Modules

Each module ends with: its Vitest + Playwright tests green, the full earlier suite green, `npm run build` clean, screenshots to you, then I wait.

| # | Module | Delivers | Tests at the end |
|---|---|---|---|
| 0 | **Foundation + design system** | Scaffold, tokens, logo, UI component library, component showcase page (`/design`), app shells (public, owner, provider) | Component render tests; Playwright visual pass of `/design` at desktop + mobile |
| 1 | **Auth + roles** | Prisma schema base, customer sign-up/login, provider login, session, route guards, seeded demo owner/vet/lab | Password + session unit tests; e2e: sign-up, login, logout, owner blocked from `/provider`, provider blocked from `/app` |
| 2 | **Landing + public pages** | Landing page (hero with illustration, supported routes, how it works, pricing preview), provider landing | e2e: navigation, CTAs, mobile layout |
| 3 | **Rules database + engine** | Verified rules for 3 routes with official URL + last-verified date; pure engine: requirements, task dependencies, date windows backwards from departure, blocking flags, earliest feasible date | Unit tests: each route × species, missing dates, wrong species, unsupported route, changed date, infeasible date, tapeworm window, age limits |
| 4 | **Pets + questionnaire** | My Pets (multi-pet), adaptive questionnaire following your flowchart incl. unsupported-species, missing-details and unsupported-route branches, trip creation | API tests; e2e for each flowchart branch |
| 5 | **Dashboard, checklist, timeline** | Bento dashboard (countdown, progress ring, next task, warnings), checklist with sources, timeline, trip switcher, edit date → plan recalculates | e2e: plan matches engine output, deadline-conflict warning, date change |
| 6 | **Documents + extraction** | Upload, vault, PDF parsing, extracted fields with confidence + evidence, profile mismatch flags, Needs Review, sample PDFs, tasks update from verified data | Extraction unit tests on sample PDFs (incl. mismatch + bad format); e2e upload flow |
| 7 | **Vet network + appointments (owner side)** | Provider directory matched by required service + credentials, simulated slots, appointment request, consent-based document sharing | Matching unit tests; e2e: find vet from a task, request slot, share record |
| 8 | **Vet portal** | Request inbox, accept/decline/offer slot, pet + trip summary, shared-doc review, record treatment, issue demo certificate → owner tasks auto-complete, order lab test | e2e across two logins; access test: vet cannot open unshared document |
| 9 | **Lab portal** | Order queue, enter/upload result, result updates owner checklist and notifies vet; owner can request optional tests | e2e: vet orders → lab posts → owner sees result |
| 10 | **Flights + e-ticket** | Airline + pet-policy data, logos, flight search with pet eligibility explanation, simulated booking, boarding-pass e-ticket, carrier tasks added to checklist | Eligibility unit tests (weight, breed, cabin/hold); e2e search → book → ticket on dashboard |
| 11 | **Pricing, checkout, insurance** | Explore / Travel Plan £19 / Complete £39 gating, simulated checkout, insurance discovery page with illustrative offer cards | Gating unit tests; e2e upgrade unlocks features |
| 12 | **Notifications, calendar, concierge** | Deadline reminders, notification centre, .ics export, concierge chat grounded in the trip's rules with source links and escalation | .ics + concierge unit tests (never answers outside rules); e2e |
| 13 | **Hardening + demo** | Settings (consent, delete data), audit log, accessibility + mobile pass, seeded demo journey, README with demo logins | Full-journey e2e (owner → vet → lab → flight → readiness 100%), full suite, production build |

Modules 3 and 10 have no dependency on UI modules; 7–9 depend on 6; everything depends on 0–1.

## Safeguards from the blueprint

- Rules are checked against gov.uk, Irish DAFM and CDC/USDA pages during module 3; anything unverifiable is marked unverified and shown as such.
- Extracted data is never presented as an authenticated certificate; vet certificates, slots, flights, payments and insurer offers are labelled as simulated/sample.
- Owners see only their own pets; providers see only records shared with them.

## Things I'll need from you

- Permission to download a small set of airline logo images into `public/airlines/` in module 10 (I'll name the source and files when asking).
- I'll copy your attached plane illustration into `public/` as the logo in module 0.

## Verification

Per module as in the table. Final: `npm test`, `npx playwright test`, `npm run build`, and a live walkthrough in the browser pane of the 90-second demo path from the blueprint.
