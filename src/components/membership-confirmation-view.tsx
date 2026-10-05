"use client";

import Link from "@/components/storefront-link";
import { Arrow } from "@/components/brand";
import { JourneyLoading, StorageNotice } from "@/components/commerce-provider";
import { EmptyState } from "@/components/empty-state";
import { useMembership } from "@/components/membership-provider";
import { formatUsd } from "@/lib/money";

export function MembershipConfirmationView() {
  const { state } = useMembership();
  if (!state.ready)
    return <JourneyLoading label="Loading your demo membership…" />;
  if (!state.enrollment)
    return (
      <>
        <div className="container">
          <StorageNotice issue={state.storageIssue} subject="demo membership" />
        </div>
        <EmptyState
          eyebrow="MEMBERSHIP CONFIRMATION"
          title="Your next chapter awaits."
          description="There’s no active demo membership to show. Discover Nano Motion Plus and start your simulated enrollment."
          href="/membership"
          action="Explore Nano Motion Plus"
        />
      </>
    );
  const enrollment = state.enrollment;
  return (
    <div className="container journey-page confirmation-page">
      <header className="page-heading">
        <p className="eyebrow">DEMO MEMBERSHIP ACTIVE</p>
        <h1>A little more possibility.</h1>
        <p className="body-copy">
          Welcome to your fictional Nano Motion Plus membership. No payment was
          taken, and no recurring billing will occur.
        </p>
      </header>
      <StorageNotice issue={state.storageIssue} subject="demo membership" />
      <div className="journey-grid">
        <section className="confirmation-details">
          <span className="confirmation-check" aria-hidden="true">
            ✓
          </span>
          <h2>Your next chapter, together.</h2>
          <dl className="outcome-details">
            <div>
              <dt>Demo enrollment</dt>
              <dd className="enrollment-id">{enrollment.id}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>
                <time dateTime={enrollment.createdAt}>
                  {new Date(enrollment.createdAt).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          <p className="body-copy">
            {state.storageIssue === "unavailable"
              ? "Your demo membership is available for this visit. Refreshing may lose the saved enrollment."
              : "Your enrollment is saved on this browser. Returning or refreshing displays the same membership."}
          </p>
          <Link href="/shop" className="button">
            Explore the essentials
            <Arrow />
          </Link>
        </section>
        <aside
          className="journey-summary membership-confirmation-summary"
          aria-label="Membership summary"
        >
          <span className="plan-mark" aria-hidden="true">
            nm+
          </span>
          <p className="eyebrow">{enrollment.plan.name}</p>
          <dl className="order-totals">
            <div>
              <dt>Status</dt>
              <dd>Active demo</dd>
            </div>
            <div>
              <dt>Plan interval</dt>
              <dd>Monthly</dd>
            </div>
            <div className="total-row">
              <dt>
                Initial enrollment <span>USD</span>
              </dt>
              <dd className="membership-amount">
                {formatUsd(enrollment.plan.amountCents)}
              </dd>
            </div>
          </dl>
          <ul className="demo-benefits">
            {enrollment.plan.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          <p className="purchase-note">
            Fictional benefits. The amount represents the simulated first
            monthly enrollment, with no real charge or renewal.
          </p>
        </aside>
      </div>
    </div>
  );
}
