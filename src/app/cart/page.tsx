import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <EmptyState
      eyebrow="YOUR CART"
      title="Room for your next move."
      description="Your cart is empty. Explore the collection while shopping features are on their way."
      href="/shop"
      action="Explore the collection"
    />
  );
}
