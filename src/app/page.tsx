import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/brand";
import { ProductCard } from "@/components/product-card";
import { products } from "@/data/products";
import motionLandscape from "../../public/images/motion-landscape.png";

export default function HomePage() {
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> A new pace. An everyday purpose.
          </p>
          <h1>
            Made for
            <br />
            your <em>next</em>
            <br />
            move.
          </h1>
          <p className="body-copy">
            Thoughtful essentials for the miles, the moments, and everything in
            motion.
          </p>
          <Link href="/shop" className="button">
            Explore the collection
            <Arrow />
          </Link>
          <div className="hero-caption">
            <span>01 / THE EVERYDAY COLLECTION</span>
            <span>RUN · TRAIN · RESET</span>
          </div>
        </div>
        <div className="hero-art">
          <Image
            src={motionLandscape}
            alt="An illustrated runner moving through a sunlit landscape, framed by flowing track lines"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 55vw"
          />
          <span className="hero-art-label">ALWAYS IN MOTION.</span>
          <span className="hero-art-coordinate">37° N / 122° W</span>
        </div>
      </section>
      <div className="manifesto">
        <p>
          Move with intention.
          <span />
          Make room for possibility.
          <span />
          Find your own pace.
        </p>
      </div>
      <section
        className="collection-section container"
        aria-labelledby="collection-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE ESSENTIALS</p>
            <h2 id="collection-heading">Less, but better.</h2>
          </div>
          <Link href="/shop" className="text-link">
            Shop all essentials
            <Arrow />
          </Link>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
      <section
        className="membership-banner container"
        aria-labelledby="membership-heading"
      >
        <div>
          <p className="eyebrow">NANO MOTION PLUS</p>
          <h2 id="membership-heading">
            A little more
            <br />
            for your everyday.
          </h2>
          <p>Member pricing. Early access. More reasons to keep moving.</p>
          <Link href="/membership" className="button button-light">
            Discover the membership
            <Arrow />
          </Link>
        </div>
        <div className="membership-art" aria-hidden="true">
          <span>
            nm<span>+</span>
          </span>
          <div className="membership-orbit" />
        </div>
      </section>
    </>
  );
}
