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

Signed in as any demo account, the dark **demo bar** at the top switches to the owner, vet or lab in one click. Real accounts never see it, and it's hidden when `DEMO_MODE=false`.

Sample PDFs to upload are on the Documents page and in `public/samples/` (regenerate with `npm run samples`).

## 6-minute demo

Run `npm run db:demo` just before each run-through. It resets the demo owner to a week before the trip, with dates relative to today: **Bella**, a 9 kg Cockapoo, flies Great Britain to France in 8 days and comes home a week later. Her rabies certificate is confirmed, a microchip certificate is waiting for review, and the account is on the Travel Plan.

| Time | Where | Show |
|---|---|---|
| 0:00 | `/` | The problem: government pages list rules, PetJet turns them into a dated plan. |
| 0:40 | Log in as the pet owner, dashboard | 8 days to go, readiness 3 of 7, the health certificate next, "1 document to check". |
| 1:20 | Documents → microchip certificate | Details read from the PDF with the line they came from. Confirm. |
| 2:00 | Trip → Animal health certificate → Find a vet | Official vets only. Choose a time, share the records (consent), request. |
| 2:40 | Demo bar → **Switch to vet** | The request and its notification. Open the shared record, Accept, Issue demo certificate, Order a titre test. |
| 3:30 | Demo bar → **Switch to lab** | The order. Enter 0.8 IU/mL, Post result. |
| 4:00 | Demo bar → **Switch to pet owner** | The bell: confirmed, certificate issued, test ordered, result. Mark all read. The certificate step is done. |
| 4:30 | Flights | Bella is over the 8 kg cabin limit, so the hold. Upgrade (simulated £39), book Air France out, then the cargo flight home (it ticks off the approved route). E-ticket. |
| 5:30 | Dashboard | **Ready to fly**: 6 of 7, with only the tapeworm dose before coming home left (it can't be given until 1–5 days before re-entering Great Britain). Insurance if there's time. |

Everything simulated (document reading, the certificate, the lab result, flights, payment, insurance) is labelled as a sample in the app.

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
