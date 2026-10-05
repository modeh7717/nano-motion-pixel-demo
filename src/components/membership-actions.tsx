"use client";

import Link from "@/components/storefront-link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { withMeasurementDebug } from "@/lib/measurement-debug";
import { Arrow } from "@/components/brand";
import { StorageNotice } from "@/components/commerce-provider";
import { useMembership } from "@/components/membership-provider";

export function MembershipActions() {
  const { state, actions } = useMembership();
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const join = () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      actions.enroll();
      router.push(
        withMeasurementDebug("/membership-confirmation", window.location.search),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Please try joining again.",
      );
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      {state.enrollment ? (
        <>
          <p className="membership-active" role="status">
            Your demo membership is active.
          </p>
          <Link className="button" href="/membership-confirmation">
            View your membership
            <Arrow />
          </Link>
        </>
      ) : (
        <button
          type="button"
          className="button"
          onClick={join}
          disabled={!state.ready || busy}
        >
          Join demo membership
          <Arrow />
        </button>
      )}
      {error && (
        <p className="action-error" role="alert">
          {error}
        </p>
      )}
      <StorageNotice issue={state.storageIssue} subject="demo membership" />
    </>
  );
}
