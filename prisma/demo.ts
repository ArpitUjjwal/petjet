/* `npm run db:demo`: resets the demo owner to the middle of their journey. See demo-journey.ts. */
import { db } from "@/lib/db";
import { addDays, formatDate, todayISO } from "@/lib/rules/dates";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "./demo-accounts";
import { DEMO_TRIP_DAYS, seedDemoJourney } from "./demo-journey";

async function main() {
  const today = todayISO();
  await seedDemoJourney(today);
  const out = formatDate(addDays(today, DEMO_TRIP_DAYS.out));
  console.log(
    [
      "Demo ready.",
      `  Bella the Cockapoo flies Great Britain to France on ${out}, home a week later.`,
      "  Rabies certificate confirmed; microchip certificate waiting for review; Travel Plan (upgrade to book flights).",
      `  Log in as ${DEMO_ACCOUNTS.owner.email} (password ${DEMO_PASSWORD}) and use the demo bar to switch to the vet and lab.`,
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
