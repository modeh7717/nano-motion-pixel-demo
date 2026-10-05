"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { ComponentProps } from "react";
import { withMeasurementDebug } from "@/lib/measurement-debug";

type StorefrontLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

function DebugAwareLink({ href, ...props }: StorefrontLinkProps) {
  const params = useSearchParams();
  // The current URL is the only source of truth: removing the flag immediately
  // stops propagation. Updating the actual href also supports opening a new tab.
  return (
    <Link href={withMeasurementDebug(href, params.toString())} {...props} />
  );
}

export default function StorefrontLink(props: StorefrontLinkProps) {
  // Keep each link's normal HTML available during static rendering; only its
  // query-aware destination waits for the browser's current search parameters.
  return (
    <Suspense fallback={<Link {...props} />}>
      <DebugAwareLink {...props} />
    </Suspense>
  );
}
