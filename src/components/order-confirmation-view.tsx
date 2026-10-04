"use client";

import Link from "next/link";
import { Arrow } from "@/components/brand";
import {
  JourneyLoading,
  StorageNotice,
  useCommerce,
} from "@/components/commerce-provider";
import { EmptyState } from "@/components/empty-state";
import { OrderSummary } from "@/components/order-summary";

export function OrderConfirmationView() {
  const { state } = useCommerce();
  if (!state.ready) return <JourneyLoading label="Loading your demo order…" />;
  if (!state.order)
    return (
      <>
        <div className="container">
          <StorageNotice
            issue={state.storageIssue}
            subject="cart and demo orders"
          />
        </div>
        <EmptyState
          eyebrow="ORDER CONFIRMATION"
          title="No order to show just yet."
          description="You haven’t placed a demo order. Explore the collection to get started."
          href="/shop"
          action="Back to the collection"
        />
      </>
    );

  const order = state.order;
  return (
    <div className="container journey-page confirmation-page">
      <header className="page-heading">
        <p className="eyebrow">DEMO ORDER COMPLETE</p>
        <h1>A good move.</h1>
        <p className="body-copy">
          Your simulated order is complete. Nothing was charged and no shipment
          will be made.
        </p>
      </header>
      <StorageNotice
        issue={state.storageIssue}
        subject="cart and demo orders"
      />
      <div className="journey-grid">
        <section className="confirmation-details">
          <span className="confirmation-check" aria-hidden="true">
            ✓
          </span>
          <h2>Your essentials, all together.</h2>
          <dl className="outcome-details">
            <div>
              <dt>Demo order</dt>
              <dd className="order-id">{order.id}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>
                <time dateTime={order.createdAt}>
                  {new Date(order.createdAt).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          <p className="body-copy">
            {state.storageIssue === "unavailable"
              ? "Your order is available for this visit. Refreshing may lose the saved outcome."
              : "Your order is saved on this browser. Refreshing this page displays the same order."}
          </p>
          <Link href="/shop" className="button">
            Keep exploring
            <Arrow />
          </Link>
        </section>
        <aside className="journey-summary" aria-label="Completed order summary">
          <p className="eyebrow">ORDER DETAILS</p>
          <OrderSummary snapshot={order.snapshot} />
        </aside>
      </div>
    </div>
  );
}
