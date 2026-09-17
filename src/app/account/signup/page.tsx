import type { Metadata } from "next";
import { AccountAuthForm } from "@/app/account/components/AccountAuthForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a customer account.",
};

export default function AccountSignupPage() {
  return <AccountAuthForm mode="signup" />;
}

