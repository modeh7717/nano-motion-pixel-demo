import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/components/storefront-link";
import { BrandMark } from "@/components/brand";
import { Navigation } from "@/components/navigation";
import { CommerceProvider } from "@/components/commerce-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { MeasurementInspector } from "@/components/measurement-inspector";
import {
  MeasurementProvider,
  MeasurementPreferences,
  ConsentBanner,
} from "@/components/measurement-provider";
import "./globals.css";

// Root layout = the shared shell for every storefront route. This remains a
// Server Component; browser storage, consent, and SDK calls belong to the client
// providers below. Keeping those providers here preserves their committed stores
// during Next.js client navigation. A refresh/new tab creates a new document and
// new stores, which restore their saved state after hydration.
export const metadata: Metadata = {
  title: {
    default: "Nano Motion — Made for your next move",
    template: "%s | Nano Motion",
  },
  description:
    "A fictional premium activewear storefront. Explore considered essentials for running, training, and everyday movement.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {/* Measurement must wrap commerce and membership: their providers use
            its context to translate successful business actions into events.
            Mounting this provider does not itself load the OpenAI script;
            loading is controlled by accepted consent in the measurement store. */}
        <MeasurementProvider
          pixelId={
            process.env.NEXT_PUBLIC_OPENAI_PIXEL_ID ?? "T8bLgKF4RsYWhHwHnPDJWg"
          }
        >
          <CommerceProvider>
            <MembershipProvider>
              <a href="#main-content" className="skip-link">
                Skip to content
              </a>
              <div className="announcement">
                A fictional storefront demo · Find your next move
              </div>
              <header className="site-header">
                <div className="container header-inner">
                  <Link
                    className="brand"
                    href="/"
                    aria-label="Nano Motion home"
                  >
                    <BrandMark />
                    <span>NANO MOTION</span>
                  </Link>
                  <Navigation />
                </div>
              </header>
              {/* Unknown consent shows a choice before page content. Declining
                  measurement still leaves all shopping actions available. */}
              <ConsentBanner />
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
              <footer className="site-footer">
                <div className="container footer-top">
                  <div>
                    <Link
                      className="brand"
                      href="/"
                      aria-label="Nano Motion home"
                    >
                      <BrandMark />
                      <span>NANO MOTION</span>
                    </Link>
                    <p>Less noise. More motion.</p>
                  </div>
                  <nav aria-label="Footer navigation">
                    <Link href="/shop">Shop the collection</Link>
                    <Link href="/membership">Nano Motion Plus</Link>
                    <Link href="/cart">Your cart</Link>
                  </nav>
                </div>
                <div className="container footer-bottom">
                  <span>© {new Date().getFullYear()} Nano Motion</span>
                  <span>Fictional products. Demo only. No real purchases.</span>
                </div>
                <div className="container">
                  {/* Persistent access to reset/revoke consent on every route. */}
                  <MeasurementPreferences />
                </div>
              </footer>
              {/* The inspector reads useSearchParams() for its production debug
                  flag. Suspense keeps that browser-dependent UI from blocking
                  static rendering of the storefront. Its CSS fixes the launcher
                  to the viewport even though it is mounted after the footer. */}
              <Suspense fallback={null}>
                <MeasurementInspector />
              </Suspense>
            </MembershipProvider>
          </CommerceProvider>
        </MeasurementProvider>
      </body>
    </html>
  );
}
