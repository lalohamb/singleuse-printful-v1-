import type { Metadata } from "next";
import { AccountDashboardClient } from "@/app/account/components/AccountDashboardClient";

export const metadata: Metadata = {
  title: "My Account",
  description: "Track orders and manage your Gender Apparel account.",
};

export default function AccountPage() {
  return <AccountDashboardClient />;
}

