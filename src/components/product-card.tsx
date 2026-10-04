import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/data/products";
import { formatUsd } from "@/lib/money";
import { Arrow } from "@/components/brand";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.slug}`} className="product-card">
      <div className="product-image">
        <span className="product-category">{product.category}</span>
        <Image
          src={product.image}
          alt={product.imageAlt}
          width={600}
          height={680}
        />
        <span className="product-card-arrow">
          <Arrow />
        </span>
      </div>
      <div className="product-card-info">
        <h3>{product.name}</h3>
        <span>{formatUsd(product.priceCents)}</span>
      </div>
      <p className="product-color">{product.color} · Everyday performance</p>
    </Link>
  );
}
