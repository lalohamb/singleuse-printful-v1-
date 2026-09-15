import type { Metadata } from "next";
import { OrderDetailClient } from "@/app/account/components/OrderDetailClient";

export const metadata: Metadata = {
  title: "Order Tracking",
  description: "Track a Gender Apparel order.",
};

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}

