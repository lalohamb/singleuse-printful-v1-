import type { User } from "@supabase/supabase-js";
import type { Order } from "@/types";

export type CustomerAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export type CustomerPreferences = {
  teeSize: string;
  hoodieSize: string;
  fit: string;
  favoriteCategory: string;
  personalizationText: string;
  preferredContact: "email" | "sms";
  smsTrackingOptIn: boolean;
};

export type CustomerProfile = {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  newsletterOptIn: boolean;
  address: CustomerAddress;
  preferences: CustomerPreferences;
};

export const SAMPLE_CUSTOMER: CustomerProfile = {
  username: "jordanstyle",
  fullName: "Jordan Taylor",
  email: "jordan.taylor@example.com",
  phone: "555-0148",
  newsletterOptIn: true,
  address: {
    name: "Jordan Taylor",
    line1: "1234 Market Street",
    line2: "Apt 2B",
    city: "Chicago",
    state: "IL",
    zip: "60616",
    country: "US",
  },
  preferences: {
    teeSize: "L",
    hoodieSize: "XL",
    fit: "Relaxed",
    favoriteCategory: "Hoodies",
    personalizationText: "Culture First",
    preferredContact: "email",
    smsTrackingOptIn: false,
  },
};

type UserMetadata = {
  username?: string;
  full_name?: string;
  phone?: string;
  newsletter_opt_in?: boolean;
  address?: Partial<CustomerAddress>;
  preferences?: Partial<CustomerPreferences>;
};

export function getCustomerProfile(user: User | null): CustomerProfile {
  const metadata = (user?.user_metadata || {}) as UserMetadata;
  const address = { ...SAMPLE_CUSTOMER.address, ...(metadata.address || {}) };
  const preferences = { ...SAMPLE_CUSTOMER.preferences, ...(metadata.preferences || {}) };

  return {
    username: metadata.username || SAMPLE_CUSTOMER.username,
    fullName: metadata.full_name || user?.email?.split("@")[0] || SAMPLE_CUSTOMER.fullName,
    email: user?.email || SAMPLE_CUSTOMER.email,
    phone: metadata.phone || SAMPLE_CUSTOMER.phone,
    newsletterOptIn: metadata.newsletter_opt_in ?? SAMPLE_CUSTOMER.newsletterOptIn,
    address: {
      ...address,
      name: address.name || metadata.full_name || SAMPLE_CUSTOMER.fullName,
    },
    preferences,
  };
}

export function formatAddress(address: CustomerAddress): string {
  return [address.line1, address.line2, `${address.city}, ${address.state} ${address.zip}`, address.country]
    .filter(Boolean)
    .join(", ");
}

export function getOrderStage(order: Pick<Order, "status" | "fulfillment_status" | "tracking_number" | "printify_order_id">): number {
  if (order.status === "cancelled") return -1;
  if (order.status === "delivered" || order.fulfillment_status === "delivered") return 6;
  if (order.status === "shipped" || order.tracking_number) return 5;
  if (order.fulfillment_status && ["in-production", "fulfilled", "partially-fulfilled"].includes(order.fulfillment_status)) return 4;
  if (order.printify_order_id || order.status === "fulfilled") return 3;
  if (order.status === "paid") return 2;
  if (order.status === "pending") return 1;
  return 0;
}

export const ORDER_STEPS = [
  "Order placed",
  "Payment received",
  "Awaiting approval",
  "Sent to fulfillment",
  "In production",
  "Shipped",
  "Delivered",
];
