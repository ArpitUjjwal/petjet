import type { Metadata } from "next";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  return (
    <AuthLayout
      eyebrow="Pet owners"
      title="Create your account"
      description="Start a travel plan for your pet in a few minutes."
      panelTitle="From first vaccination to boarding gate."
      panelPoints={[
        "Tell us about your pet and your trip",
        "Get a dated, sourced checklist",
        "Upload records and book what's missing",
      ]}
      footer={
        <p>
          Already have an account?{" "}
          <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-medium text-forest-800 underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      }
    >
      <AuthForm mode="signup" action={signup} submitLabel="Create account" next={nextPath} />
    </AuthLayout>
  );
}
