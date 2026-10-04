import type { Metadata } from "next";
import { OrderConfirmationView } from "@/components/order-confirmation-view";

export const metadata: Metadata = { title: "Order confirmation" };

export default function OrderConfirmationPage() {
  return <OrderConfirmationView />;
}
