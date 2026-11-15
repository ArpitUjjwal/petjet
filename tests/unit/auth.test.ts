// @vitest-environment node
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { homeFor, isProviderRole, isRole, loginFor } from "@/lib/auth/roles";
import { areaOf, guard, safeNext } from "@/lib/auth/routes";
import { signSession, verifySession } from "@/lib/auth/token";
import { fieldErrorsFrom, loginSchema, signupSchema } from "@/lib/auth/validation";

const SECRET = "unit-test-secret-that-is-long-enough-123456";
const OTHER_SECRET = "a-different-secret-that-is-long-enough-9876";

describe("passwords", () => {
  it("hashes with a salt and verifies", async () => {
    const a = await hashPassword("Correct-horse-42");
    const b = await hashPassword("Correct-horse-42");
    expect(a).not.toBe("Correct-horse-42");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Correct-horse-42", a)).toBe(true);
    expect(await verifyPassword("correct-horse-42", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
  });

  it("returns false for a missing or malformed hash instead of throwing", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", undefined)).toBe(false);
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips user id and role", async () => {
    const token = await signSession({ userId: "u1", role: "VET" }, SECRET);
    expect(await verifySession(token, SECRET)).toEqual({ userId: "u1", role: "VET" });
  });

  it("rejects missing, garbage, tampered and wrong-secret tokens", async () => {
    const token = await signSession({ userId: "u1", role: "OWNER" }, SECRET);
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession("", SECRET)).toBeNull();
    expect(await verifySession("abc.def.ghi", SECRET)).toBeNull();
    expect(await verifySession(token, OTHER_SECRET)).toBeNull();

    // Swap the payload for one claiming a different role, keeping the signature.
    const [h, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u1", role: "VET", exp: 9999999999 })).toString(
      "base64url",
    );
    expect(await verifySession(`${h}.${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signSession({ userId: "u1", role: "OWNER" }, SECRET, -60);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("rejects a validly signed token with an unknown role or no subject", async () => {
    const key = new TextEncoder().encode(SECRET);
    const sign = (claims: Record<string, unknown>, sub?: string) => {
      const jwt = new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h");
      if (sub) jwt.setSubject(sub);
      return jwt.sign(key);
    };
    expect(await verifySession(await sign({ role: "ADMIN" }, "u1"), SECRET)).toBeNull();
    expect(await verifySession(await sign({ role: "OWNER" }), SECRET)).toBeNull();
    expect(await verifySession(await sign({}, "u1"), SECRET)).toBeNull();
  });

  it("rejects unsigned (alg none) tokens", async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = `${enc({ alg: "none" })}.${enc({ sub: "u1", role: "OWNER" })}.`;
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("refuses to sign with a missing or short secret", async () => {
    await expect(signSession({ userId: "u1", role: "OWNER" }, "")).rejects.toThrow(/SESSION_SECRET/);
    await expect(signSession({ userId: "u1", role: "OWNER" }, "short")).rejects.toThrow(
      /SESSION_SECRET/,
    );
    expect(await verifySession("abc", "")).toBeNull();
  });
});

describe("roles", () => {
  it("recognises roles and their homes", () => {
    expect(isRole("OWNER")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isProviderRole("VET")).toBe(true);
    expect(isProviderRole("LAB")).toBe(true);
    expect(isProviderRole("OWNER")).toBe(false);
    expect(homeFor("OWNER")).toBe("/app");
    expect(homeFor("LAB")).toBe("/provider");
    expect(loginFor("OWNER")).toBe("/login");
    expect(loginFor("VET")).toBe("/provider/login");
  });
});

describe("route guard", () => {
  it("classifies areas", () => {
    expect(areaOf("/")).toBe("public");
    expect(areaOf("/design")).toBe("public");
    expect(areaOf("/application")).toBe("public");
    expect(areaOf("/providers")).toBe("public");
    expect(areaOf("/app")).toBe("owner");
    expect(areaOf("/app/pets/1")).toBe("owner");
    expect(areaOf("/provider")).toBe("provider");
    expect(areaOf("/provider/lab-orders")).toBe("provider");
    expect(areaOf("/provider/login")).toBe("guest-only");
    expect(areaOf("/login")).toBe("guest-only");
    expect(areaOf("/signup")).toBe("guest-only");
  });

  it("lets everyone into public pages", () => {
    for (const role of [null, "OWNER", "VET", "LAB"] as const) {
      expect(guard("/", role)).toBeNull();
      expect(guard("/design", role)).toBeNull();
    }
  });

  it("sends guests to the matching login and remembers where they were going", () => {
    expect(guard("/app", null)).toBe("/login?next=%2Fapp");
    expect(guard("/app/documents", null, "?tab=shared")).toBe(
      "/login?next=%2Fapp%2Fdocuments%3Ftab%3Dshared",
    );
    expect(guard("/provider", null)).toBe("/provider/login?next=%2Fprovider");
    expect(guard("/provider/lab-orders", null)).toBe("/provider/login?next=%2Fprovider%2Flab-orders");
  });

  it("keeps owners out of the provider portal and providers out of the owner app", () => {
    expect(guard("/provider", "OWNER")).toBe("/app");
    expect(guard("/provider/lab-orders", "OWNER")).toBe("/app");
    expect(guard("/app", "VET")).toBe("/provider");
    expect(guard("/app/documents", "LAB")).toBe("/provider");
  });

  it("lets each role into its own area", () => {
    expect(guard("/app", "OWNER")).toBeNull();
    expect(guard("/app/pets", "OWNER")).toBeNull();
    expect(guard("/provider", "VET")).toBeNull();
    expect(guard("/provider/results", "LAB")).toBeNull();
  });

  it("sends signed-in users away from login and sign-up pages", () => {
    expect(guard("/login", "OWNER")).toBe("/app");
    expect(guard("/signup", "OWNER")).toBe("/app");
    expect(guard("/provider/login", "VET")).toBe("/provider");
    expect(guard("/login", "LAB")).toBe("/provider");
    expect(guard("/login", null)).toBeNull();
    expect(guard("/provider/login", null)).toBeNull();
  });
});

describe("safeNext", () => {
  it("allows paths inside the role's own area", () => {
    expect(safeNext("/app/documents", "OWNER")).toBe("/app/documents");
    expect(safeNext("/app/documents?tab=shared", "OWNER")).toBe("/app/documents?tab=shared");
    expect(safeNext("/provider/lab-orders", "VET")).toBe("/provider/lab-orders");
  });

  it("falls back to home for anything else", () => {
    const bad = [
      undefined,
      null,
      "",
      42,
      "https://evil.example/app",
      "//evil.example/app",
      "/\\evil.example",
      "javascript:alert(1)",
      "app/documents",
      "/",
      "/design",
      "/login",
      "/provider",
      "/provider/lab-orders",
      "/app/../provider",
      "/app\n/x",
    ];
    for (const next of bad) expect(safeNext(next, "OWNER"), String(next)).toBe("/app");
    expect(safeNext("/app/documents", "VET")).toBe("/provider");
    expect(safeNext("/provider/login", "LAB")).toBe("/provider");
  });
});

describe("validation", () => {
  it("accepts and normalises a good sign-up", () => {
    const r = signupSchema.safeParse({
      name: "  Mariyam Khan ",
      email: "  Mariyam@Example.COM ",
      password: "Travel-with-Milo-1",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Mariyam Khan");
      expect(r.data.email).toBe("mariyam@example.com");
    }
  });

  it("reports one clear message per bad field", () => {
    const r = signupSchema.safeParse({ name: "", email: "nope", password: "short" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fieldErrorsFrom(r.error)).toEqual({
        name: "Enter your full name.",
        email: "Enter a valid email address, like name@example.com.",
        password: "Use at least 10 characters.",
      });
    }
  });

  it("enforces password rules", () => {
    const check = (password: string) =>
      signupSchema.safeParse({ name: "Test User", email: "a@b.co", password }).success;
    expect(check("abcdefghij1")).toBe(true);
    expect(check("abcdefghijk")).toBe(false); // no number
    expect(check("12345678901")).toBe(false); // no letter
    expect(check("a1".repeat(40))).toBe(false); // over bcrypt's 72 byte limit
  });

  it("login requires both fields but does not apply sign-up password rules", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    const r = loginSchema.safeParse({ email: "", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(fieldErrorsFrom(r.error)).toEqual({
        email: "Enter your email address.",
        password: "Enter your password.",
      });
    }
  });
});
