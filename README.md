# PetJet

Pet travel, simplified. PetJet turns international pet travel rules into a personalised, dated plan, reads your pet's documents, and connects you with vets, labs and pet-friendly flights.

This is a working prototype for a 6-minute presentation. Everything simulated (document reading, vet certificates, lab results, flights, payments, insurance offers) is labelled as a sample in the app. Supported routes: Great Britain to France, Ireland and the USA (and back).

Progress and plans: [`docs/PROGRESS.md`](docs/PROGRESS.md), [`docs/plan-lean.md`](docs/plan-lean.md).

## Setup

Needs Node.js 20 or later. Everything runs locally: SQLite, no external accounts.

```bash
npm install                     # also generates the Prisma client
cp .env.example .env            # then set SESSION_SECRET (openssl rand -base64 32)
npx prisma db push              # creates prisma/dev.db
npm run db:seed                 # demo accounts, partner vets and the verified rules
npm run db:demo                 # the demo owner, mid-journey (run again to reset)
npm run dev                     # http://localhost:3000
```

After pulling changes to `prisma/schema.prisma`, run `npx prisma db push` and restart `npm run dev`. The running server keeps the old database client in memory until you restart it.

## Demo accounts

Password for all: `PetJet-demo-2026` (the login pages have one-click demo buttons).

| Role | Email | Logs in at |
|---|---|---|
| Pet owner | mariyam@petjet.test | `/login` |
| Vet (Riverside Veterinary Centre) | vet@petjet.test | `/provider/login` |
| Lab (Northgate Pathology) | lab@petjet.test | `/provider/login` |

Signed in as the demo owner, the dark **demo bar** at the top has **Restart demo**, which puts the guided journey back to step 1. The vet and lab portals still work at `/provider/login` (their demo bar switches back to the owner). Real accounts never see the bar, and it's hidden when `DEMO_MODE=false`. On the landing page, **Try the demo** signs in as the demo owner in one click.

Sample PDFs to upload are on the Documents page and in `public/samples/` (regenerate with `npm run samples`).

## The app at a glance

Four tabs: **Home** (the trip and a 5-step journey with one button for the next step), **Trip plan** (the checklist, details folded away), **Documents**, and **Bookings** (vet, flights and insurance). Pets, notifications and plans are one tap away from these.

## 4-minute demo

Run `npm run db:demo` (or press **Restart demo**) before each run-through. **Bella**, a 9 kg Cockapoo, flies Great Britain to France in 8 days and comes home a week later. Her rabies certificate is confirmed, a microchip certificate is waiting to be checked, and the account is on the Complete plan.

| Time | Where | Show |
|---|---|---|
| 0:00 | `/` | The problem, then **Try the demo**. |
| 0:30 | Home | 8 days to go, readiness 3 of 7, the journey at step 1, and **Cost and savings**: the estimated total, what it saves against booking each part alone, and against a relocation agency. |
| 0:50 | 1. Check documents | Details read from the PDF, each with the line it came from. **Looks right, confirm**. |
| 1:30 | 2. Health certificate | Best-match official vet, first time and record sharing already chosen. One tap: the practice accepts and the appointment completes by itself (simulated); the bell lights up. |
| 2:10 | 3. Book flights | Bella is over the 8 kg cabin limit, so the hold out and cargo home (the approved route). **Book both flights**. |
| 2:40 | 4. Insure Bella | Four sample insurers with logos; the recommended one is preselected. **Compare all details**, then **Choose this cover**. |
| 3:30 | 5. Ready to fly | Boarding passes and the policy on Home; only the tapeworm dose before coming home is left, shown as "while you're away". **See the breakdown**: every line booked, with the saving on each. |

Everything simulated (document reading, the vet's reply and certificate, flights, payment, insurance, and the partner prices and agency quotes behind the savings) is labelled as a sample in the app. The cost figures live in `src/lib/trips/costs.ts`.

## Tests

```bash
npm test                 # unit tests (Vitest), uses prisma/unit.db
npx playwright install   # first time only: browsers for the end-to-end tests
npx playwright test      # end-to-end, desktop + mobile, including the full demo journey; builds the app and uses prisma/test.db
npm run typecheck
npm run lint
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma + SQLite · pdf.js · Framer Motion · Vitest · Playwright.

`AGENTS.md` notes that this Next.js version differs from older docs; read `node_modules/next/dist/docs/` before changing framework-level code.
