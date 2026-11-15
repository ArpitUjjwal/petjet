"use client";

import { AlertTriangle, ArrowRight, KeyRound } from "lucide-react";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import type { AuthFormState } from "@/lib/auth/validation";

type Action = (state: AuthFormState, form: FormData) => Promise<AuthFormState>;

export type DemoAccount = { label: string; email: string; password: string };

export function AuthForm({
  mode,
  action,
  submitLabel,
  next,
  demoAccounts = [],
}: {
  mode: "login" | "signup";
  action: Action;
  submitLabel: string;
  next?: string;
  demoAccounts?: DemoAccount[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fill(account: DemoAccount) {
    if (emailRef.current) emailRef.current.value = account.email;
    if (passwordRef.current) passwordRef.current.value = account.password;
    passwordRef.current?.focus();
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.message && (
        <Callout tone="danger" icon={<AlertTriangle className="size-4.5" />} title={state.message} />
      )}
      {next && <input type="hidden" name="next" value={next} />}

      {mode === "signup" && (
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="e.g. Mariyam Khan"
          defaultValue={state.values?.name}
          error={state.fieldErrors?.name}
          required
        />
      )}
      <Input
        ref={emailRef}
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@example.com"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        required
      />
      <Input
        ref={passwordRef}
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        hint={mode === "signup" ? "At least 10 characters, with a letter and a number." : undefined}
        error={state.fieldErrors?.password}
        required
      />

      <Button type="submit" size="lg" loading={pending} iconRight={<ArrowRight className="size-4" />}>
        {submitLabel}
      </Button>

      {demoAccounts.length > 0 && (
        <div className="rounded-control border border-dashed border-line-strong bg-cream-50 p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <KeyRound className="size-4 text-tan-600" />
            Demo accounts
          </p>
          <p className="mt-1 text-[13px] text-ink-500">
            Fill the form with a seeded demo account, then press {submitLabel.toLowerCase()}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {demoAccounts.map((account) => (
              <Button key={account.email} variant="secondary" size="sm" onClick={() => fill(account)}>
                {account.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
