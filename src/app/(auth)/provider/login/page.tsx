import type { Metadata } from "next";
import Link from "next/link";
import { loginProvider } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { demoAccountsFor } from "@/lib/auth/demo";

export const metadata: Metadata = { title: "Provider login" };

export default async function ProviderLoginPage({ searchParams }: PageProps<"/provider/login">) {
  const { next } = await searchParams;
  return (
    <AuthLayout
      eyebrow="Vets & pathology labs"
      title="Provider login"
      description="Manage travel appointments, shared records and lab tests."
      panelTitle="Clients who arrive prepared."
      panelPoints={[
        "Requests come with the pet, trip and required service",
        "See only the records an owner chose to share",
        "Record treatments and results that update the owner's plan",
      ]}
      footer={
        <div className="flex flex-col gap-2">
          <p>Provider accounts are set up by PetJet during partner onboarding.</p>
          <p>
            Travelling with your pet?{" "}
            <Link href="/login" className="font-medium text-forest-800 underline-offset-4 hover:underline">
              Customer login
            </Link>
          </p>
        </div>
      }
    >
      <AuthForm
        mode="login"
        action={loginProvider}
        submitLabel="Log in"
        next={typeof next === "string" ? next : undefined}
        demoAccounts={demoAccountsFor("provider")}
      />
    </AuthLayout>
  );
}
