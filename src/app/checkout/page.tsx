import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <EmptyState
      eyebrow="DEMO CHECKOUT"
      title="Start with an essential."
      description="There are no items to check out. Simulated checkout will arrive with the shopping features."
      href="/shop"
      action="Browse essentials"
    />
  );
}
