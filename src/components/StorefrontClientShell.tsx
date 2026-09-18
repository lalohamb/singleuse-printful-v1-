"use client";
import CartDrawer from "@/components/CartDrawer";
import NewsletterPopup from "@/components/NewsletterPopup";
import NewsletterSignup from "@/components/NewsletterSignup";
export default function StorefrontClientShell() {
  return (
    <>
      <CartDrawer />
      <NewsletterPopup />
      <div className="bg-secondary-900 border-t border-secondary-700 px-4 py-10">
        <NewsletterSignup variant="footer" />
      </div>
    </>
  );
}
