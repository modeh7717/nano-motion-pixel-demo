"use client";

import Link from "@/components/storefront-link";
import { useState } from "react";
import { Arrow } from "@/components/brand";
import { StorageNotice, useCommerce } from "@/components/commerce-provider";

export function AddToCart({ productId }: { productId: string }) {
  const { state, actions } = useCommerce();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    try {
      actions.addItem(productId);
      setError("");
      setMessage("Added to your cart.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to add this essential.",
      );
    }
  };
  return (
    <div className="purchase-controls">
      <button
        type="button"
        className="button"
        onClick={add}
        disabled={!state.ready}
      >
        Add to cart
        <Arrow />
      </button>
      <p className="purchase-note">Fictional product · Simulated orders only</p>
      <p role="status" className="action-status">
        {message && (
          <>
            {message} <Link href="/cart">View cart</Link>
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="action-error">
          {error}
        </p>
      )}
      <StorageNotice
        issue={state.storageIssue}
        subject="cart and demo orders"
      />
    </div>
  );
}
