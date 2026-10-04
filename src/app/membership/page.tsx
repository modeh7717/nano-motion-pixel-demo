import type { Metadata } from "next";

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
        <h2>Nano Motion Plus</h2>
        <p className="plan-price">
          $19<span>/ month · USD</span>
        </p>
        <ul>
          <li>Member pricing on everyday essentials</li>
          <li>Early access to new collections</li>
          <li>Free standard shipping</li>
        </ul>
        <button className="button" disabled>
          Enrollment coming soon
        </button>
        <p className="plan-note">
          Demo plan with fictional benefits. No enrollment or billing is
          available in this release.
        </p>
      </div>
    </section>
  );
}
