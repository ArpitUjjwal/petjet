import { FeatureBento } from "@/components/marketing/feature-bento";
import { Hero } from "@/components/marketing/hero";
import { CtaBand, Faq, HowItWorks, Pricing, RouteCards } from "@/components/marketing/sections";
import { PublicShell } from "@/components/shell/public-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/roles";

export default async function Home() {
  const user = await getCurrentUser();
  /* Guests and owners start the questionnaire; provider accounts go to their portal. */
  const primaryHref = !user || user.role === "OWNER" ? "/plan" : homeFor(user.role);

  return (
    <PublicShell>
      <Hero primaryHref={primaryHref} />
      <FeatureBento />
      <HowItWorks />
      <RouteCards />
      <Pricing primaryHref={primaryHref} />
      <Faq />
      <CtaBand
        title="Your pet's next trip starts with a plan."
        body="Tell us about your pet and where you're going. It takes about three minutes."
        href={primaryHref}
        label="Plan my trip"
      />
    </PublicShell>
  );
}
