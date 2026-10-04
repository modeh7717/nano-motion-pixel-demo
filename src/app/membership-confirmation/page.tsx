import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Membership confirmation" };

export default function MembershipConfirmationPage() {
  return (
    <EmptyState
      eyebrow="MEMBERSHIP CONFIRMATION"
      title="Your next chapter awaits."
      description="There’s no active demo membership to show. Discover Nano Motion Plus while enrollment is on its way."
      href="/membership"
      action="Explore Nano Motion Plus"
    />
  );
}
