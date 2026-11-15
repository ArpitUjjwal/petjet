import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(254, "That email address is too long.")
  .email("Enter a valid email address, like name@example.com.");

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(80, "That name is too long."),
  email,
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(72, "Use 72 characters or fewer.")
    .regex(/[a-zA-Z]/, "Include at least one letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200, "That password is too long."),
});

export type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export type AuthFormState = {
  /** A message about the whole form, e.g. wrong credentials */
  message?: string;
  fieldErrors?: FieldErrors;
  /** Values echoed back so the form is not cleared on error. Never includes the password. */
  values?: { name?: string; email?: string };
};

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "name" || field === "email" || field === "password") && !out[field]) {
      out[field] = issue.message;
    }
  }
  return out;
}
