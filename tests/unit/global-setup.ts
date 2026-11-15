import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

/* A throwaway SQLite database for repository tests, rebuilt on every run. */
export default function setup() {
  const root = path.resolve(__dirname, "../..");
  for (const f of ["prisma/unit.db", "prisma/unit.db-journal"]) rmSync(path.join(root, f), { force: true });
  /* Files uploaded by repository tests */
  rmSync(path.join(root, "storage", "unit-uploads"), { recursive: true, force: true });
  execSync("npx prisma db push --skip-generate", {
    cwd: root,
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./unit.db" },
  });
}
