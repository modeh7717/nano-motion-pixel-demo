export type MembershipPlan = Readonly<{
  id: string;
  name: string;
  amountCents: number;
  currency: "USD";
  interval: "month";
  benefits: readonly string[];
}>;

export const membershipPlan: MembershipPlan = Object.freeze({
  id: "nano-motion-plus-monthly",
  name: "Nano Motion Plus",
  amountCents: 1900,
  currency: "USD",
  interval: "month",
  benefits: Object.freeze([
    "Member pricing on everyday essentials",
    "Early access to new collections",
    "Free standard shipping",
  ]),
});
