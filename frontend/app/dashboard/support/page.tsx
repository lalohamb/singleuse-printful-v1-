export default function SupportPage() {
  const DOCS = [
    { title: 'Getting Started Guide', href: '#', desc: 'Set up your store from scratch' },
    { title: 'Connecting Printify', href: '#', desc: 'API key setup and catalog sync' },
    { title: 'Stripe Setup', href: '#', desc: 'Accept payments on your store' },
    { title: 'Custom Domain Setup', href: '#', desc: 'DNS configuration and SSL' },
    { title: 'Self-Hosting Guide', href: '#', desc: 'Deploy on your own server' },
  ];

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-black mb-1">Support</h1>
      <p className="text-text-secondary text-sm mb-8">Documentation and help resources.</p>

      <div className="space-y-3 mb-8">
        {DOCS.map(({ title, href, desc }) => (
          <a key={title} href={href}
            className="flex items-center justify-between bg-surface border border-border rounded-xl p-4 hover:border-brand/50 transition-colors group">
            <div>
              <div className="font-medium group-hover:text-brand transition-colors">{title}</div>
              <div className="text-text-secondary text-sm">{desc}</div>
            </div>
            <span className="text-text-secondary text-lg">→</span>
          </a>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="font-semibold mb-2">Contact Support</h2>
        <p className="text-text-secondary text-sm mb-4">We respond within a few hours on business days.</p>
        <a href="mailto:hello@printifyplatform.com"
          className="inline-block bg-brand-gradient px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
          Email Support
        </a>
      </div>
    </div>
  );
}
