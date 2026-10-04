import Link from "next/link";
import { Arrow, BrandMark } from "@/components/brand";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
};

export function EmptyState({
  eyebrow,
  title,
  description,
  href,
  action,
}: EmptyStateProps) {
  return (
    <section className="empty-state container">
      <span className="empty-state-mark">
        <BrandMark />
      </span>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="body-copy">{description}</p>
      <Link href={href} className="button">
        {action}
        <Arrow />
      </Link>
    </section>
  );
}
