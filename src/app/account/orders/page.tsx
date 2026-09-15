import type { Metadata } from "next";
import { OrdersClient } from "@/app/account/components/OrdersClient";

export const metadata: Metadata = {
  title: "My Orders",
  description: "Review and track your Gender Apparel orders.",
};

export default function AccountOrdersPage() {
  return <OrdersClient />;
}

