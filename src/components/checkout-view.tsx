"use client";

import Link from "@/components/storefront-link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { withMeasurementDebug } from "@/lib/measurement-debug";
import { Arrow } from "@/components/brand";
import {
  JourneyLoading,
  StorageNotice,
  useCommerce,
} from "@/components/commerce-provider";
import { EmptyState } from "@/components/empty-state";
import { OrderSummary } from "@/components/order-summary";

export function CheckoutView() {
  const { state, actions } = useCommerce();

  useEffect(() => {
    if (state.ready && state.cart.length) actions.ensureCheckout();
  }, [state.ready, state.cart, actions]);

  if (!state.ready) return <JourneyLoading label="Loading your checkout…" />;
  if (!state.cart.length)
    return (
      <>
        <div className="container">
          <StorageNotice
            issue={state.storageIssue}
            subject="cart and demo orders"
          />
        </div>
        <EmptyState
          eyebrow="DEMO CHECKOUT"
          title="Start with an essential."
          description="There are no items to check out. Explore the collection to begin a simulated order."
          href="/shop"
          action="Browse essentials"
        />
      </>
    );
  const attempt = state.checkout;
  if (!attempt || attempt.status !== "active")
    return <JourneyLoading label="Preparing your demo checkout…" />;

  return (
    <div className="container journey-page">
      <header className="page-heading">
        <p className="eyebrow">DEMO CHECKOUT</p>
        <h1>Your next move starts here.</h1>
        <p className="body-copy">
          A simulated order. A real chance to explore the journey.
        </p>
      </header>
      <StorageNotice
        issue={state.storageIssue}
        subject="cart and demo orders"
      />
      <div className="journey-grid">
        <section className="checkout-explanation">
          <span className="step-number">01 / REVIEW & COMPLETE</span>
          <h2>All set. No card needed.</h2>
          <p className="body-copy">
            This is a fictional storefront. Completing this demo saves an order
            for this browser and clears your cart. Nothing will be charged or
            shipped.
          </p>
          <ul className="demo-benefits">
            <li>No payment information</li>
            <li>No personal details</li>
            <li>No real transaction</li>
          </ul>
          <Link href="/cart" className="text-link">
            Return to cart
            <Arrow />
          </Link>
        </section>
        <aside className="journey-summary" aria-label="Order summary">
          <p className="eyebrow">YOUR DEMO ORDER</p>
          <OrderSummary snapshot={attempt.snapshot} />
          <CompleteOrder key={attempt.id} attemptId={attempt.id} />
          <p className="purchase-note">
            You will not be charged. This creates a simulated order.
          </p>
        </aside>
      </div>
    </div>
  );
}

function CompleteOrder({ attemptId }: { attemptId: string }) {
  const { actions } = useCommerce();
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const complete = () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      actions.completeCheckout(attemptId);
      router.push(
        withMeasurementDebug("/order-confirmation", window.location.search),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Please try completing your demo order again.",
      );
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="button"
        onClick={complete}
        disabled={busy}
      >
        Complete demo order
        <Arrow />
      </button>
      {error && (
        <p role="alert" className="action-error">
          {error}
        </p>
      )}
    </>
  );
}
