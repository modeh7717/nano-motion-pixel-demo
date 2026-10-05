import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/storefront-link";
import { notFound } from "next/navigation";
import { Arrow } from "@/components/brand";
import { ProductCard } from "@/components/product-card";
import { AddToCart } from "@/components/add-to-cart";
import { getProductBySlug, products } from "@/data/products";
import { formatUsd } from "@/lib/money";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  return {
    title: product?.name ?? "Product not found",
    description: product?.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <div className="container product-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/shop">The collection</Link>
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </nav>
      <section className="product-detail">
        <div className="detail-image">
          <Image
            src={product.image}
            alt={product.imageAlt}
            width={600}
            height={680}
            priority
          />
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {product.category} / {product.id}
          </p>
          <h1>{product.name}</h1>
          <p className="detail-price">
            {formatUsd(product.priceCents)} <span>USD</span>
          </p>
          <p className="body-copy">{product.description}</p>
          <div className="color-description">
            <span
              className={`color-swatch swatch-${product.color.toLowerCase()}`}
            />
            {product.color}
          </div>
          <ul className="product-features">
            {product.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
          <AddToCart productId={product.id} />
          <Link href="/shop" className="text-link">
            Explore the full collection
            <Arrow />
          </Link>
        </div>
      </section>
      <section className="related-products" aria-labelledby="related-heading">
        <div className="section-heading">
          <h2 id="related-heading">Keep good company.</h2>
        </div>
        <div className="product-grid">
          {products
            .filter((item) => item.id !== product.id)
            .map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
        </div>
      </section>
    </div>
  );
}
