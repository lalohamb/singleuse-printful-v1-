import type { Metadata } from "next";
import { AddressesClient } from "@/app/account/components/AddressesClient";

export const metadata: Metadata = {
  title: "Saved Addresses",
  description: "Manage saved shipping details for your account.",
};

export default function AccountAddressesPage() {
  return <AddressesClient />;
}

