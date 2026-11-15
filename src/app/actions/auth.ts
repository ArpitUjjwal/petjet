"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isProviderRole, isRole } from "@/lib/auth/roles";
import { safeNext } from "@/lib/auth/routes";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  fieldErrorsFrom,
  loginSchema,
  signupSchema,
  type AuthFormState,
} from "@/lib/auth/validation";

const BAD_CREDENTIALS = "That email and password don't match an account.";

function text(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export async function signup(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const raw = { name: text(form, "name"), email: text(form, "email"), password: text(form, "password") };
  const values = { name: raw.name, email: raw.email };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const { name, email, password } = parsed.data;
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return {
      fieldErrors: { email: "An account with this email already exists. Log in instead." },
      values,
    };
  }

  let userId: string;
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: "OWNER" },
      select: { id: true },
    });
    userId = user.id;
  } catch {
    /* Unique-constraint race or database error */
    return { message: "We couldn't create your account. Please try again.", values };
  }

  await createSession({ userId, role: "OWNER" });
  redirect(safeNext(text(form, "next"), "OWNER"));
}

async function loginTo(
  portal: "owner" | "provider",
  form: FormData,
): Promise<AuthFormState> {
  const raw = { email: text(form, "email"), password: text(form, "password") };
  const values = { email: raw.email };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true, passwordHash: true },
  });
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !ok || !isRole(user.role)) return { message: BAD_CREDENTIALS, values };

  /* Only say which portal to use once the password has been proven correct. */
  const provider = isProviderRole(user.role);
  if (portal === "owner" && provider) {
    return { message: "This is a vet or lab account. Use the provider login instead.", values };
  }
  if (portal === "provider" && !provider) {
    return { message: "This is a pet owner account. Use the customer login instead.", values };
  }

  await createSession({ userId: user.id, role: user.role });
  redirect(safeNext(text(form, "next"), user.role));
}

export async function loginOwner(_prev: AuthFormState, form: FormData) {
  return loginTo("owner", form);
}

export async function loginProvider(_prev: AuthFormState, form: FormData) {
  return loginTo("provider", form);
}

export async function logout() {
  await destroySession();
  redirect("/");
}
