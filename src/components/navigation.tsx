"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCommerce } from "@/components/commerce-provider";

export function Navigation() {
  const pathname = usePathname();
  const { state } = useCommerce();
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const links = [
    {
      href: "/shop",
      label: "Shop",
      active: pathname === "/shop" || pathname.startsWith("/product/"),
    },
    {
      href: "/membership",
      label: "Nano Motion Plus",
      active: pathname.startsWith("/membership"),
    },
    {
      href: "/cart",
      label: "Cart",
      active: pathname === "/cart" || pathname === "/checkout",
    },
  ];

  return (
    <nav aria-label="Main navigation" className="main-nav">
      {links.map(({ href, label, active }) => (
        <Link key={href} href={href} aria-current={active ? "page" : undefined}>
          {label}
          {href === "/cart" && count > 0 && (
            <span className="cart-count" aria-label={`${count} items`}>
              {count}
            </span>
          )}
          {href === "/cart" && (
            <svg
              width="17"
              height="19"
              viewBox="0 0 20 22"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 7h14l1 13H2L3 7Zm4 0V5a3 3 0 0 1 6 0v2"
                stroke="currentColor"
                strokeWidth="1.4"
              />
            </svg>
          )}
        </Link>
      ))}
    </nav>
  );
}
