import { expect, test } from "@playwright/test";
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  expectNoHorizontalScroll,
  login,
  logout,
  trackErrors,
} from "./helpers";

const SESSION_COOKIE = "petjet_session";

function uniqueEmail(project: string) {
  return `e2e-${project}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@petjet.test`;
}

test.describe("Module 1: sign-up", () => {
  test("a new owner can sign up, lands on the dashboard and gets a secure cookie", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const errors = trackErrors(page);
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your account");
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("signup.png") });

    await page.getByLabel("Full name").fill("Priya Nair");
    await page.getByLabel("Email").fill(uniqueEmail(info.project.name));
    await page.getByLabel("Password").fill("Travel-with-Milo-1");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Priya.");
    if (!isMobile) await expect(page.getByText("Pet owner", { exact: true })).toBeVisible();

    const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    expect(cookie, "session cookie is set").toBeTruthy();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
    expect(errors).toEqual([]);
  });

  test("shows field errors and keeps what was typed, except the password", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("P");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address, like name@example.com.")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
    await expect(page.getByLabel("Password")).toHaveValue("");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("rejects an email that already has an account", async ({ page, context }) => {
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("Someone Else");
    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.owner.email.toUpperCase());
    await page.getByLabel("Password").fill("Travel-with-Milo-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists.")).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
  });
});

test.describe("Module 1: login and logout", () => {
  test("owner logs in with the demo shortcut, then logs out", async ({ page, context, isMobile }, info) => {
    const errors = trackErrors(page);
    await page.goto("/login");
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Demo pet owner" }).click();
    await expect(page.getByLabel("Email")).toHaveValue(DEMO_ACCOUNTS.owner.email);
    await page.screenshot({ path: info.outputPath("login.png") });
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL("**/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Mariyam.");
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath("owner-home.png") });

    await logout(page, isMobile);
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);

    // The session is really gone: the app is closed again.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    expect(errors).toEqual([]);
  });

  test("wrong password and unknown email give the same message", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.owner.email);
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: "Log in" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "don't match an account" });
    await expect(alert).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(DEMO_ACCOUNTS.owner.email);

    await page.getByLabel("Email").fill("nobody-here@petjet.test");
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(alert).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
  });

  test("empty login form shows required-field messages", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("vet logs in to the vet portal", async ({ page, isMobile }, info) => {
    const errors = trackErrors(page);
    await page.goto("/provider/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Provider login");
    await page.screenshot({ path: info.outputPath("provider-login.png") });
    await login(page, "vet");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Appointment requests");
    await expect(page.getByText("Riverside Veterinary Centre")).toBeVisible();
    await expect(page.getByText("Verified partner")).toBeVisible();
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Requests" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("vet-home.png") });
    expect(errors).toEqual([]);
  });

  test("lab logs in to the lab portal, which has different navigation", async ({ page, isMobile }) => {
    await login(page, "lab");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test orders");
    await expect(page.getByText("Northgate Pathology Laboratory")).toBeVisible();
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Test orders" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Requests" })).toHaveCount(0);
  });

  test("each login page refuses the other kind of account", async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.vet.email);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Use the provider login instead.")).toBeVisible();

    await page.goto("/provider/login");
    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.owner.email);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Use the customer login instead.")).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
  });
});

test.describe("Module 1: route guards", () => {
  test("guests are sent to the right login page", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
    await page.goto("/provider");
    await expect(page).toHaveURL(/\/provider\/login\?next=%2Fprovider$/);
  });

  test("after login the owner returns to the page they asked for", async ({ page }) => {
    await page.goto("/app/pets");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fpets$/);
    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.owner.email);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/app/pets");
  });

  test("an off-site next parameter is ignored", async ({ page }) => {
    await page.goto("/login?next=https://example.com/steal");
    await page.getByLabel("Email").fill(DEMO_ACCOUNTS.owner.email);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/app");
    expect(new URL(page.url()).host).toBe("localhost:3100");
  });

  test("an owner cannot open the provider portal", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/provider");
    await expect(page).toHaveURL(/\/app$/);
    await page.goto("/provider/lab-orders");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("vets and labs cannot open the owner app", async ({ page }) => {
    await login(page, "vet");
    await page.goto("/app");
    await expect(page).toHaveURL(/\/provider$/);
    await page.goto("/app/documents");
    await expect(page).toHaveURL(/\/provider$/);
  });

  test("signed-in users are sent away from login and sign-up pages", async ({ page }) => {
    await login(page, "owner");
    for (const path of ["/login", "/signup", "/provider/login"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/app$/);
    }
  });

  test("a forged or garbage cookie does not grant access", async ({ page, context }) => {
    await context.addCookies([
      { name: SESSION_COOKIE, value: "abc.def.ghi", url: "http://localhost:3100" },
    ]);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  });

  test("a valid cookie for a deleted account is cleared instead of looping", async ({
    page,
    context,
    isMobile,
  }, info) => {
    // Sign up a throwaway account, then delete it through the database-backed API path:
    // we simulate deletion by signing a cookie for a user id that does not exist.
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode("playwright-only-session-secret-0123456789abcdef");
    const token = await new SignJWT({ role: "OWNER" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(`ghost-${info.project.name}`)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    await context.addCookies([{ name: SESSION_COOKIE, value: token, url: "http://localhost:3100" }]);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
    expect((await context.cookies()).some((c) => c.name === SESSION_COOKIE)).toBe(false);
    void isMobile;
  });
});
