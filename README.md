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

Sample PDFs to upload are on the Documents page and in `public/samples/` (regenerate with `npm run samples`).

## Tests

```bash
npm test                 # unit tests (Vitest), uses prisma/unit.db
npx playwright install   # first time only: browsers for the end-to-end tests
npx playwright test      # end-to-end, desktop + mobile; builds the app and uses prisma/test.db
npm run typecheck
npm run lint
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma + SQLite · pdf.js · Framer Motion · Vitest · Playwright.

`AGENTS.md` notes that this Next.js version differs from older docs; read `node_modules/next/dist/docs/` before changing framework-level code.
