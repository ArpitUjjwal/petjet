/* Price points from the business plan. They are hypotheses to test, and payments are simulated. */
export type TierId = "EXPLORE" | "PLAN" | "COMPLETE";

export type Tier = {
  id: TierId;
  name: string;
  /** Price in whole pounds per trip; 0 means free */
  price: number;
  tagline: string;
  features: string[];
  highlighted?: boolean;
};

export const TIERS: Tier[] = [
  {
    id: "EXPLORE",
    name: "Explore",
    price: 0,
    tagline: "See what your route involves.",
    features: [
      "Destination overview for supported routes",
      "General guidance with official sources",
      "Check whether your pet and route are supported",
    ],
  },
  {
    id: "PLAN",
    name: "Travel Plan",
    price: 19,
    tagline: "Your personal, dated checklist.",
    highlighted: true,
    features: [
      "Everything in Explore",
      "Personalised checklist from verified rules",
      "Timeline worked back from your departure",
      "Deadline reminders and calendar export",
    ],
  },
  {
    id: "COMPLETE",
    name: "Complete",
    price: 39,
    tagline: "We help you get every task done.",
    features: [
      "Everything in Travel Plan",
      "Document checks on uploaded records",
      "Vet and lab appointment coordination",
      "Pet-friendly flight booking",
    ],
  },
];

export function formatPrice(price: number) {
  return price === 0 ? "Free" : `£${price}`;
}
