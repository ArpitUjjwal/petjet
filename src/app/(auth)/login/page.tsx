import type { Metadata } from "next";
import Link from "next/link";
import { loginOwner } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { demoAccountsFor } from "@/lib/auth/demo";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <AuthLayout
      eyebrow="Pet owners"
      title="Welcome back"
      description="Log in to see your pet's travel plan."
      panelTitle="Everything your pet needs to fly, in one plan."
      panelPoints={[
        "A checklist built from official rules, with sources",
        "Deadlines worked back from your departure date",
        "Vets, labs and flights that fit your pet",
      ]}
      footer={
        <div className="flex flex-col gap-2">
          <p>
            New to PetJet?{" "}
            <Link href="/signup" className="font-medium text-forest-800 underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
          <p>
            Vet or pathology lab?{" "}
            <Link
              href="/provider/login"
              className="font-medium text-forest-800 underline-offset-4 hover:underline"
            >
              Provider login
            </Link>
          </p>
        </div>
      }
    >
      <AuthForm
        mode="login"
        action={loginOwner}
        submitLabel="Log in"
        next={typeof next === "string" ? next : undefined}
        demoAccounts={demoAccountsFor("owner")}
      />
    </AuthLayout>
  );
}
