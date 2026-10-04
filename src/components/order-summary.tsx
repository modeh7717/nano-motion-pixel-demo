import Image from "next/image";
import { products } from "@/data/products";
import type { PurchaseSnapshot } from "@/lib/commerce/model";
import { lineTotal } from "@/lib/commerce/model";
import { formatUsd } from "@/lib/money";

export function OrderSummary({ snapshot }: { snapshot: PurchaseSnapshot }) {
  return (
    <>
      <ul className="summary-items">
        {snapshot.items.map((item) => {
          const product = products.find(
            (product) => product.id === item.productId,
          )!;
          return (
            <li key={item.productId} className="summary-item">
              <Image
                src={product.image}
                alt={product.imageAlt}
                width={64}
                height={73}
              />
              <div>
                <h3>{item.name}</h3>
                <p>
                  {formatUsd(item.unitPriceCents)} × {item.quantity}
                </p>
              </div>
              <span>
                {formatUsd(lineTotal(item.unitPriceCents, item.quantity))}
              </span>
            </li>
          );
        })}
      </ul>
      <dl className="order-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatUsd(snapshot.totalCents)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>$0.00</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>$0.00</dd>
        </div>
        <div className="total-row">
          <dt>
            Total <span>USD</span>
          </dt>
          <dd className="order-total">{formatUsd(snapshot.totalCents)}</dd>
        </div>
      </dl>
    </>
  );
}
