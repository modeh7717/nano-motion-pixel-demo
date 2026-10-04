import type { Metadata } from "next";
import { MembershipActions } from "@/components/membership-actions";
import { membershipPlan } from "@/data/membership";
import { formatUsd } from "@/lib/money";

export const metadata: Metadata = { title: "Nano Motion Plus" };

export default function MembershipPage() {
  return (
    <section className="container membership-page">
      <div className="membership-intro">
        <p className="eyebrow">NANO MOTION PLUS</p>
        <h1>
          Your pace.
          <br />A few more
          <br />
          <em>possibilities.</em>
        </h1>
        <p className="body-copy">
          A little extra for the way you move. Meet our fictional membership,
          designed to make your everyday go further.
        </p>
      </div>
      <div className="membership-plan">
        <span className="plan-mark" aria-hidden="true">
          nm+
        </span>
        <p className="eyebrow">THE EVERYDAY MEMBERSHIP</p>
        <h2>{membershipPlan.name}</h2>
        <p className="plan-price">
          {formatUsd(membershipPlan.amountCents)}
          <span>/ month · USD</span>
        </p>
        <ul>
          {membershipPlan.benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
        <MembershipActions />
        <p className="plan-note">
          Demo plan with fictional benefits. Joining creates a simulated
          enrollment. No real charge or recurring billing.
        </p>
      </div>
    </section>
  );
}
