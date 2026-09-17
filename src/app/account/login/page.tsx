import type { Metadata } from "next";
import { AccountAuthForm } from "@/app/account/components/AccountAuthForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your customer account.",
};

export default function AccountLoginPage() {
  return <AccountAuthForm mode="login" />;
}

