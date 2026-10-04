import type { Metadata } from "next";
import { MembershipConfirmationView } from "@/components/membership-confirmation-view";

export const metadata: Metadata = { title: "Membership confirmation" };

export default function MembershipConfirmationPage() {
  return <MembershipConfirmationView />;
}
