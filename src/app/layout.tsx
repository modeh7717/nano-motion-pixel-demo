import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { Navigation } from "@/components/navigation";
import { CommerceProvider } from "@/components/commerce-provider";
import { MembershipProvider } from "@/components/membership-provider";
import "./globals.css";

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
                <Link className="brand" href="/" aria-label="Nano Motion home">
                  <BrandMark />
                  <span>NANO MOTION</span>
                </Link>
                <Navigation />
              </div>
            </header>
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
            </footer>
          </MembershipProvider>
        </CommerceProvider>
      </body>
    </html>
  );
}
