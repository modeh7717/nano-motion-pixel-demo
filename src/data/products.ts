export type Product = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: "Running" | "Training" | "Yoga";
  readonly description: string;
  readonly priceCents: number;
  readonly currency: "USD";
  readonly image: string;
  readonly imageAlt: string;
  readonly color: string;
  readonly highlights: readonly string[];
};

export const products = [
  {
    id: "NM-RUN-001",
    slug: "aero-run-jacket",
    name: "Aero Run Jacket",
    category: "Running",
    description:
      "Light on your shoulders. Ready for the elements. A streamlined outer layer for early starts, open trails, and the miles ahead.",
    priceCents: 14800,
    currency: "USD",
    image: "/images/aero-run-jacket.svg",
    imageAlt: "Illustration of a moss green zip-front running jacket",
    color: "Moss",
    highlights: [
      "Lightweight woven shell",
      "Adjustable hood",
      "Zipped side pockets",
    ],
  },
  {
    id: "NM-TRN-002",
    slug: "velocity-legging",
    name: "Velocity Legging",
    category: "Training",
    description:
      "Find your rhythm. A sculpted, high-rise essential with a close fit and freedom to move, from your first warm-up to your last rep.",
    priceCents: 11800,
    currency: "USD",
    image: "/images/velocity-legging.svg",
    imageAlt: "Illustration of charcoal high-rise training leggings",
    color: "Graphite",
    highlights: [
      "Supportive high-rise waist",
      "Four-way stretch",
      "Smooth, minimal seams",
    ],
  },
  {
    id: "NM-YGA-003",
    slug: "motion-performance-tee",
    name: "Motion Performance Tee",
    category: "Yoga",
    description:
      "Room to breathe. A soft, easy layer that moves with you through slow mornings, deep stretches, and everything in between.",
    priceCents: 6800,
    currency: "USD",
    image: "/images/motion-performance-tee.svg",
    imageAlt: "Illustration of a warm off-white short-sleeve performance tee",
    color: "Chalk",
    highlights: [
      "Soft-touch performance fabric",
      "Relaxed everyday fit",
      "Classic crew neckline",
    ],
  },
] as const satisfies readonly Product[];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
