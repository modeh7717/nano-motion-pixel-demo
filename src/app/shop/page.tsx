import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";

export const metadata: Metadata = { title: "The collection" };

export default function ShopPage() {
  return (
    <div className="container collection-page">
      <header className="page-heading">
        <p className="eyebrow">RUN · TRAIN · RESET</p>
        <h1>The everyday collection.</h1>
        <p className="body-copy">
          Three considered essentials. Endless ways to move.
        </p>
      </header>
      <div className="catalog-meta">
        <span>All essentials</span>
        <span>{products.length} products · USD</span>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <p className="catalog-note">
        A fictional collection, created for this demo.
      </p>
    </div>
  );
}
