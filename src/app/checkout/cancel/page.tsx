import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-secondary-900 mb-2">Order cancelled</h1>
        <p className="text-secondary-500 mb-8">Your payment was not completed. Nothing has been charged.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/checkout" className="btn-primary">Return to checkout</Link>
          <Link href="/shop" className="btn-outline">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
