"use client";

import Image from "next/image";
import Link from "@/components/storefront-link";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { products } from "@/data/products";
import { lineTotal, purchaseSnapshot } from "@/lib/commerce/model";
import { formatUsd } from "@/lib/money";

export function CartView() {
  const { state, actions } = useCommerce();
  const router = useRouter();
  const starting = useRef(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!busy) starting.current = false;
  }, [busy]);

  const changeQuantity = (productId: string, quantity: number) => {
    try {
      actions.setQuantity(productId, quantity);
      setError("");
    } catch {
      setError("Use a positive whole-number quantity with a valid total.");
    }
  };
  const start = () => {
    if (starting.current) return;
    starting.current = true;
    startTransition(() => {
      try {
        if (actions.startCheckout())
          router.push(withMeasurementDebug("/checkout", window.location.search));
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Please try starting checkout again.",
        );
        starting.current = false;
      }
    });
  };

  if (!state.ready) return <JourneyLoading label="Loading your cart…" />;
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
          eyebrow="YOUR CART"
          title="Room for your next move."
          description="Your cart is empty. Find your next essential in the collection."
          href="/shop"
          action="Explore the collection"
        />
      </>
    );
  const snapshot = purchaseSnapshot(state.cart);

  return (
    <div className="container journey-page">
      <header className="page-heading">
        <p className="eyebrow">YOUR CART</p>
        <h1>A few good essentials.</h1>
        <p className="body-copy">
          Ready for your next move. Review your demo order below.
        </p>
      </header>
      <StorageNotice
        issue={state.storageIssue}
        subject="cart and demo orders"
      />
      <div className="journey-grid">
        <section aria-label="Cart items">
          <ul className="cart-items">
            {state.cart.map((item) => {
              const product = products.find(
                (product) => product.id === item.productId,
              )!;
              return (
                <li className="cart-item" key={item.productId}>
                  <Link
                    href={`/product/${product.slug}`}
                    className="cart-item-image"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Image
                      src={product.image}
                      alt=""
                      width={120}
                      height={136}
                    />
                  </Link>
                  <div className="cart-item-details">
                    <p className="eyebrow">{product.category}</p>
                    <h2>
                      <Link href={`/product/${product.slug}`}>
                        {product.name}
                      </Link>
                    </h2>
                    <p>
                      {product.color} · {formatUsd(product.priceCents)} each
                    </p>
                    <div className="cart-item-controls">
                      <label>
                        Quantity
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label={`Quantity for ${product.name}`}
                          value={item.quantity}
                          onChange={(event) =>
                            changeQuantity(
                              item.productId,
                              event.target.valueAsNumber,
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="remove-item"
                        aria-label={`Remove ${product.name}`}
                        onClick={() => {
                          actions.removeItem(item.productId);
                          setError("");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="line-total">
                    {formatUsd(lineTotal(product.priceCents, item.quantity))}
                  </span>
                </li>
              );
            })}
          </ul>
          {error && (
            <p role="alert" className="action-error">
              {error}
            </p>
          )}
          <Link href="/shop" className="text-link">
            Continue exploring
            <Arrow />
          </Link>
        </section>
        <aside className="journey-summary" aria-label="Order summary">
          <p className="eyebrow">ORDER SUMMARY</p>
          <OrderSummary snapshot={snapshot} />
          <button
            type="button"
            className="button"
            onClick={start}
            disabled={busy}
          >
            Begin demo checkout
            <Arrow />
          </button>
          <p className="purchase-note">
            Demo only. No payment or personal details required.
          </p>
        </aside>
      </div>
    </div>
  );
}
