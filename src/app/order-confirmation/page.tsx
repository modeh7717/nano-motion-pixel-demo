import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Order confirmation" };

export default function OrderConfirmationPage() {
  return (
    <EmptyState
      eyebrow="ORDER CONFIRMATION"
      title="No order to show just yet."
      description="You haven’t placed a demo order. When simulated shopping is available, your completed order will appear here."
      href="/shop"
      action="Back to the collection"
    />
  );
}
