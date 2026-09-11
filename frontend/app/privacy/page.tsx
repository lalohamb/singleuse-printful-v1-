import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PrintifyPlatform',
  description: 'Privacy Policy for PrintifyPlatform — how we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <div className="pt-24 pb-24 max-w-3xl mx-auto px-6">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-[#A0A0B0] text-sm mb-10">Effective Date: [DATE] · Last Updated: [DATE]</p>

      <div className="prose prose-invert prose-sm max-w-none
        prose-headings:text-white prose-headings:font-bold
        prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-[#2A2A3A] prose-h2:pb-2
        prose-h3:text-base prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-[#A0A0B0] prose-p:leading-relaxed
        prose-li:text-[#A0A0B0]
        prose-a:text-[#6C47FF] prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white">

        <p>
          <strong>[LEGAL COMPANY NAME]</strong>, doing business as <strong>PrintifyPlatform</strong>{' '}
          (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), respects the privacy of merchants,
          customers, visitors, and other individuals who interact with our websites, software applications, hosted
          storefronts, merchant dashboards, integrations, and related services.
        </p>
        <p>
          This Privacy Policy explains how we collect, use, disclose, store, protect, retain, and delete personal
          information and other data when you access or use our services. By accessing or using the Services, you
          acknowledge the practices described in this Privacy Policy.
        </p>

        {/* ── 1 ── */}
        <h2>1. Who We Are</h2>
        <p>
          <strong>[LEGAL COMPANY NAME]</strong> operates a software-as-a-service platform that allows merchants to
          create, operate, customize, and manage ecommerce storefronts and connect those storefronts with independent
          third-party vendors. We are an independent software provider. Unless expressly stated otherwise in writing,
          we are not owned, operated, sponsored, or endorsed by Printify or any other Third-Party Vendor referenced
          through the Platform.
        </p>

        {/* ── 2 ── */}
        <h2>2. Information We Collect</h2>
        <p>
          The information we collect depends upon how you interact with the Platform and which integrations or Services
          you use.
        </p>

        <h3>2.1 Account Information</h3>
        <p>
          When you create an account, start a trial, subscribe to the Services, or communicate with us, we may collect
          information such as name, business name, email address, telephone number, username, account identifier,
          billing contact information, subscription information, business address, support requests, and other
          information you voluntarily provide.
        </p>

        <h3>2.2 Merchant Business Information</h3>
        <p>
          When you configure your merchant account or storefront, we may collect or process information such as
          business name, storefront name, business description, domain name, logos, brand colors, product categories,
          storefront configuration, social-media links, business contact information, policies and disclosures,
          tax-related configuration, shipping settings, and other merchant-supplied business information.
        </p>

        {/* ── 3 ── */}
        <h2>3. Third-Party Vendor Account Information</h2>
        <p>
          The Platform may allow you to connect your own account with independent third-party vendors. You are
          responsible for creating and maintaining your own individual account with each Third-Party Vendor. Where an
          integration requires authorization, we may receive or process information necessary to connect your vendor
          account to the Platform, including Personal Access Tokens, API keys, OAuth access and refresh tokens, account
          identifiers, shop identifiers, access scopes, webhook secrets, connection status, vendor account metadata,
          and other authentication or authorization information. We refer to these collectively as{' '}
          <strong>&quot;Vendor Credentials.&quot;</strong>
        </p>

        {/* ── 4 ── */}
        <h2>4. Printify Account Information</h2>
        <p>
          If you choose to connect a Printify account, you must maintain your own authorized Printify merchant account.
          When you connect Printify, we may process information including your Printify account authorization,
          Personal Access Token or OAuth tokens where applicable, Printify shop identifiers, shop names, products,
          product variants, product images, pricing, product descriptions, order information, fulfillment information,
          shipping information, webhook events, catalog information, and other information made available through the
          Printify API that is necessary to provide the Services you request.
        </p>
        <p>
          We access Printify Merchant Data only after you or an authorized account holder grants access through a
          supported authorization method.
        </p>

        {/* ── 5 ── */}
        <h2>5. Merchant Data</h2>
        <p>
          <strong>&quot;Merchant Data&quot;</strong> means information relating to a merchant, merchant business,
          merchant shop, products, orders, customers, or connected vendor account that we receive directly from the
          merchant or through an authorized Third-Party Vendor integration. We access and process Merchant Data only
          for purposes described in this Privacy Policy, our Terms of Service and Merchant Agreement, or as otherwise
          authorized by the merchant.
        </p>

        {/* ── 6 ── */}
        <h2>6. Customer Information</h2>
        <p>
          When a customer interacts with a merchant storefront powered by the Platform, we may process information on
          behalf of that merchant, including customer name, email address, telephone number, shipping and billing
          address, order information, product selections, quantities, shipping method, transaction identifiers,
          fulfillment status, customer communications, IP address, browser and device information, and other
          information necessary to process or fulfill an order. The merchant remains primarily responsible for its
          relationship with its customers and for providing legally required privacy notices.
        </p>

        {/* ── 7 ── */}
        <h2>7. Payment Information</h2>
        <p>
          Payments may be processed by independent payment processors such as Stripe. Where payments are processed
          through an independent payment provider, payment-card information may be submitted directly to that payment
          provider rather than stored by us. We may receive limited transaction-related information such as payment
          status, transaction identifier, amount, currency, payment-provider identifiers, subscription status, invoice
          status, and limited billing information. We do not intentionally store full payment-card numbers unless
          specifically required for a Service and legally permitted.
        </p>

        {/* ── 8 ── */}
        <h2>8. Automatically Collected Information</h2>
        <p>
          When you access or use the Platform, we may automatically collect technical and usage information such as IP
          address, browser type, operating system, device type, referring website, pages viewed, links clicked, login
          activity, session information, approximate location derived from IP address, timestamps, error logs, API
          activity, webhook activity, application performance information, security events, and other diagnostic
          information. We may use this information to operate, maintain, secure, troubleshoot, and improve the
          Platform.
        </p>

        {/* ── 9 ── */}
        <h2>9. Cookies and Similar Technologies</h2>
        <p>
          We may use cookies, local storage, pixels, analytics technologies, session identifiers, and similar
          technologies to maintain login sessions, remember preferences, secure accounts, prevent fraud, measure
          website traffic, analyze Platform usage, improve performance, troubleshoot problems, and understand how
          visitors interact with our Services. Where applicable law requires consent for certain cookies or tracking
          technologies, we will request consent before using those technologies. Disabling necessary cookies may
          prevent portions of the Platform from functioning properly.
        </p>

        {/* ── 10 ── */}
        <h2>10. How We Use Information</h2>
        <p>We may use information we collect to:</p>
        <ol>
          <li>create and maintain merchant accounts;</li>
          <li>provide the Services and operate hosted storefronts;</li>
          <li>authenticate users and connect authorized Third-Party Vendor accounts;</li>
          <li>synchronize product catalogs, transmit orders, and obtain fulfillment and shipping information;</li>
          <li>process vendor webhooks and operate merchant dashboards;</li>
          <li>provide customer support and process subscriptions and billing;</li>
          <li>maintain Platform security, investigate suspicious activity, and detect and prevent fraud or abuse;</li>
          <li>troubleshoot technical problems and improve Platform performance;</li>
          <li>comply with applicable laws and enforce our agreements;</li>
          <li>communicate administrative or security information;</li>
          <li>provide requested marketing communications; and</li>
          <li>perform other functions expressly authorized by the merchant.</li>
        </ol>

        {/* ── 11 ── */}
        <h2>11. Use of Printify Data</h2>
        <p>
          Information obtained from Printify is used only as necessary to provide the Services requested by the
          applicable merchant or as otherwise expressly authorized — for example, to display products on a merchant
          storefront, synchronize products and variants, transmit customer orders, retrieve order and fulfillment
          status, process webhook events, and operate merchant dashboards.
        </p>
        <p>
          We do not use Printify Merchant Data for unrelated competitive benchmarking. We do not sell Printify Merchant
          Data. We do not place private Printify Merchant Data into publicly searchable directories except where
          information must be publicly displayed as part of the merchant&apos;s requested storefront functionality.
        </p>

        {/* ── 12 ── */}
        <h2>12. Minimum Necessary Data</h2>
        <p>
          We seek to access only the information reasonably necessary to provide the functionality requested by a
          merchant. Where supported, we may use limited API authorization scopes rather than requesting access to
          information that is not reasonably required by the Platform.
        </p>

        {/* ── 13 ── */}
        <h2>13. How We Share Information</h2>
        <p>We do not sell personal information or Merchant Data as part of our core SaaS business model. We may share information in the following limited circumstances.</p>

        <h3>13.1 Service Providers</h3>
        <p>
          We may provide information to vendors that perform services on our behalf, including cloud hosting, database
          services, authentication, security, email delivery, customer support, analytics, error monitoring, payment
          processing, data backup, domain services, and infrastructure services. These providers may access information
          only to the extent reasonably necessary to provide their services to us.
        </p>

        <h3>13.2 Merchant-Selected Third-Party Vendors</h3>
        <p>
          When a merchant connects or uses a Third-Party Vendor, we may transmit information to that vendor as required
          to provide the requested integration. Information transmitted to a Third-Party Vendor may thereafter be
          processed under that vendor&apos;s own privacy policy and terms.
        </p>

        <h3>13.3 Payment Processors</h3>
        <p>
          We may share billing and transaction-related information with payment processors necessary to process
          subscription fees, merchant payments, or customer transactions.
        </p>

        <h3>13.4 Legal Requirements</h3>
        <p>
          We may disclose information where we reasonably believe disclosure is required to comply with applicable law,
          a court order, lawful governmental process, or a subpoena; to enforce our agreements; to investigate fraud;
          to protect our rights, the security of the Platform, or users or members of the public; or to defend against
          legal claims.
        </p>

        <h3>13.5 Corporate Transactions</h3>
        <p>
          Information may be transferred as part of a merger, acquisition, financing, restructuring, reorganization,
          bankruptcy, sale of assets, or transfer of some or all of our business. Where required by applicable law, we
          will provide appropriate notice concerning such a transfer.
        </p>

        {/* ── 14 ── */}
        <h2>14. We Do Not Sell Vendor-Derived Merchant Data</h2>
        <p>
          We do not sell, rent, or license Merchant Data obtained through an authorized Printify or other Third-Party
          Vendor API integration for independent marketing, data-brokerage, or competitive-analysis purposes. We do not
          transfer vendor-derived data to another application solely for unrelated commercial purposes without merchant
          authorization.
        </p>

        {/* ── 15 ── */}
        <h2>15. Customer Communications</h2>
        <p>
          Where customer information is obtained through an API integration solely for purposes of providing Services
          to a merchant, we do not use that information to independently market our Platform directly to the
          merchant&apos;s customers unless the customer separately provides information directly to us, independently
          becomes our user, the merchant expressly authorizes such communication, the customer consents, or another
          lawful basis exists.
        </p>

        {/* ── 16 ── */}
        <h2>16. Data Security</h2>
        <p>
          We use administrative, technical, and organizational safeguards designed to protect information against
          unauthorized access, disclosure, destruction, alteration, misuse, loss, and unauthorized acquisition.
          Safeguards may include encryption in transit and at rest, authentication controls, access restrictions,
          role-based permissions, API credential protection, secret-management controls, logging and monitoring,
          database access controls, network protections, secure development practices, and security reviews.
        </p>
        <p>
          No internet-based system, electronic transmission, or information-storage system can be guaranteed to be
          completely secure. You are responsible for protecting your own account credentials and Vendor Credentials
          before they are submitted to or authorized for use by the Platform.
        </p>

        {/* ── 17 ── */}
        <h2>17. API and Vendor Credential Security</h2>
        <p>
          Vendor Credentials are sensitive information. We design the Platform so that private Vendor Credentials are
          used only for authorized integration functions. Where technically feasible, Vendor Credentials are processed
          through server-side systems rather than exposed through publicly accessible client-side code. We may encrypt,
          tokenize, or otherwise secure Vendor Credentials in storage. Merchants should immediately revoke and replace
          credentials if they suspect those credentials have been compromised.
        </p>

        {/* ── 18 ── */}
        <h2>18. Data Breach Response</h2>
        <p>
          If we become aware of unauthorized access to personal information or Merchant Data under our control, we will
          investigate and take actions we determine appropriate based upon the nature of the incident, the information
          affected, applicable law, contractual obligations, vendor requirements, and the likelihood of harm. Where
          required, we will provide notifications to affected individuals, merchants, regulators, or Third-Party
          Vendors.
        </p>
        <p>
          For data obtained through the Printify API, Printify&apos;s current API terms require developers to notify
          Printify of an actual or suspected compromise of Merchant Data within twenty-four (24) hours after becoming
          aware of the occurrence.
        </p>

        {/* ── 19 ── */}
        <h2>19. Data Retention</h2>
        <p>
          We retain information only for as long as reasonably necessary for the purposes described in this Privacy
          Policy, unless a longer retention period is required or permitted by law. Some limited information may be
          retained after account closure where reasonably necessary for legal, security, fraud-prevention, tax,
          accounting, or compliance purposes.
        </p>

        {/* ── 20 ── */}
        <h2>20. Printify Data Deletion</h2>
        <p>
          We apply additional deletion requirements to Merchant Data obtained through the Printify API. Except where
          prohibited or modified by applicable law, applicable Printify Merchant Data will be deleted within{' '}
          <strong>thirty (30) days</strong> when:
        </p>
        <ol>
          <li>the merchant disconnects or uninstalls the integration;</li>
          <li>the data is no longer required to provide the Services to that merchant; or</li>
          <li>we receive an enforceable deletion request from the applicable merchant, customer, or Printify.</li>
        </ol>
        <p>
          This may include deletion of originals, copies, and reproductions under our control where required by
          applicable Printify API terms. Certain information may be retained where applicable law requires or permits
          retention.
        </p>

        {/* ── 21 ── */}
        <h2>21. Disconnecting a Vendor Account</h2>
        <p>
          Merchants may disconnect supported Third-Party Vendor integrations through the Platform or by contacting us.
          When an integration is disconnected, API access may be revoked, Vendor Credentials may be deleted or
          invalidated, product and order synchronization may stop, storefront functionality dependent upon that
          integration may stop working, and vendor-derived data may be scheduled for deletion according to applicable
          retention requirements. Disconnecting the Platform does not automatically close or delete the merchant&apos;s
          independent account with the Third-Party Vendor.
        </p>

        {/* ── 22 ── */}
        <h2>22. Deleting Your Platform Account</h2>
        <p>
          You may request deletion of your Platform account by using an account deletion feature if available, or by
          contacting us at{' '}
          <a href="mailto:privacy@printifyplatform.com">privacy@printifyplatform.com</a>. Before completing a deletion
          request, we may take reasonable steps to verify your identity and authority over the account. Certain
          information may continue to be retained when necessary to satisfy legal or legitimate compliance obligations.
        </p>

        {/* ── 23 ── */}
        <h2>23. Access, Correction, and Data Portability</h2>
        <p>
          Merchants may contact us to request access to or correction of personal information associated with their
          Platform account. Where required by applicable law or applicable Third-Party Vendor requirements, we may
          provide a structured, commonly used, machine-readable copy of personal information under our control.
          Requests may be submitted to{' '}
          <a href="mailto:privacy@printifyplatform.com">privacy@printifyplatform.com</a>.
        </p>

        {/* ── 24 ── */}
        <h2>24. Privacy Rights</h2>
        <p>
          Depending upon where you reside, applicable law may provide rights concerning your personal information,
          including the right to know whether we process your personal information, request access, request correction,
          request deletion, obtain a portable copy, object to or restrict certain processing, withdraw consent, opt out
          of certain marketing or data sales where applicable, and lodge a complaint with an appropriate regulatory
          authority. Not every right applies in every jurisdiction or under every circumstance. We may require
          reasonable verification before fulfilling a privacy request.
        </p>

        {/* ── 25 ── */}
        <h2>25. U.S. State Privacy Rights</h2>
        <p>
          Residents of certain U.S. states may have additional privacy rights under applicable state privacy laws,
          including confirmation of whether personal information is processed, access, correction, deletion, data
          portability, opt-out rights concerning targeted advertising, sale of personal information, and certain
          profiling activities. We will process valid requests according to applicable law and will not unlawfully
          discriminate against an individual for exercising an applicable privacy right.
        </p>

        {/* ── 26 ── */}
        <h2>26. California Privacy Notice</h2>
        <p>
          If applicable to our business and processing activities, California residents may have rights under the
          California Consumer Privacy Act, as amended by the California Privacy Rights Act, including rights to know
          categories and sources of personal information collected, purposes for collecting or processing information,
          categories of recipients, access to specific personal information, correction, deletion, and opt-out of sale
          or sharing where applicable. We do not sell personal information as the term is ordinarily understood in
          exchange for monetary consideration.
        </p>

        {/* ── 27 ── */}
        <h2>27. Children&apos;s Privacy</h2>
        <p>
          The Platform is intended for businesses and individuals who are at least eighteen (18) years old. We do not
          knowingly allow children under thirteen (13) to establish Platform merchant accounts. If you believe a child
          has submitted personal information to us improperly, contact{' '}
          <a href="mailto:privacy@printifyplatform.com">privacy@printifyplatform.com</a>.
        </p>

        {/* ── 28 ── */}
        <h2>28. International Data Transfers</h2>
        <p>
          The Platform may use service providers located in countries other than the country in which a user resides.
          As a result, personal information may be processed or stored in the United States or other countries. Those
          countries may have privacy laws different from the laws of your jurisdiction. Where required, we will use
          legally recognized safeguards for applicable international transfers.
        </p>

        {/* ── 29 ── */}
        <h2>29. Third-Party Links and Services</h2>
        <p>
          The Platform may contain links to or integrations with websites or services operated by third parties. Those
          third parties maintain independent privacy practices. This Privacy Policy does not govern information
          processed independently by those third parties. We encourage users to review the privacy policies and terms
          of Third-Party Vendors before connecting or using their services.
        </p>

        {/* ── 30 ── */}
        <h2>30. Printify Is an Independent Third Party</h2>
        <p>
          Printify maintains its own services, API infrastructure, merchant accounts, terms, and privacy practices.
          When you establish or use a Printify account independently, Printify may collect and process information
          according to its own privacy policy. Our Privacy Policy applies to information under our control and does not
          replace or modify Printify&apos;s independent privacy policy.
        </p>

        {/* ── 31 ── */}
        <h2>31. Other Print-on-Demand Providers</h2>
        <p>
          The Platform may support additional print-on-demand providers in the future. Where you voluntarily connect
          another provider, you must maintain an authorized account with that provider, you authorize us to access the
          information required to provide the integration, we may process vendor data only for purposes consistent with
          this Privacy Policy, information transmitted to the provider may be independently processed by that provider,
          and additional vendor-specific terms or privacy requirements may apply.
        </p>

        {/* ── 32 ── */}
        <h2>32. Marketing Communications</h2>
        <p>
          If you sign up for marketing communications, we may send information concerning Platform features, product
          announcements, promotions, educational content, business resources, and related services. You may unsubscribe
          from marketing email using the unsubscribe mechanism provided in the communication. You may continue to
          receive non-promotional communications necessary for your account, including security notices, billing
          information, service notices, integration alerts, legal notices, and account-related communications.
        </p>

        {/* ── 33 ── */}
        <h2>33. Analytics</h2>
        <p>
          We may use analytics tools to understand how users interact with the Platform. Analytics data may include
          pages viewed, session duration, referring sources, device and browser information, feature usage, geographic
          information based on IP address, interaction events, and performance information. Where required by law, we
          will obtain consent before using analytics technologies that require consent.
        </p>

        {/* ── 34 ── */}
        <h2>34. Artificial Intelligence and Automated Services</h2>
        <p>
          If the Platform introduces artificial intelligence, automated content generation, recommendation systems, or
          similar functionality, information submitted to those features may be processed to provide the requested
          service. Unless separately disclosed and authorized, we will not intentionally use private Merchant Data
          obtained from a Third-Party Vendor API to train public or generalized artificial-intelligence models.
        </p>

        {/* ── 35 ── */}
        <h2>35. Aggregated and De-Identified Information</h2>
        <p>
          We may generate statistics or analytical information about Platform operation where the information has been
          reasonably aggregated or de-identified so that it is not reasonably linked to an identifiable person or
          merchant. We will not attempt to re-identify information that applicable law requires us to maintain in
          de-identified form. Nothing in this Section authorizes us to use Printify-derived information in a manner
          prohibited by applicable Printify API requirements.
        </p>

        {/* ── 36 ── */}
        <h2>36. Data Processing on Behalf of Merchants</h2>
        <p>
          For certain customer information processed through merchant storefronts, we may act as a service provider or
          processor acting on behalf of the merchant. In those circumstances, the merchant determines the purposes for
          collecting customer information, we process information as necessary to provide the Platform, and the
          merchant remains responsible for the merchant&apos;s legal relationship with its customers. Merchants should
          ensure their own storefront privacy notices accurately describe their practices and use of service providers.
        </p>

        {/* ── 37 ── */}
        <h2>37. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy periodically to reflect changes involving our Services, integrations,
          Third-Party Vendors, business practices, applicable laws, regulatory requirements, security practices, or
          technological developments. When we make changes, we will update the &quot;Last Updated&quot; date at the
          top of this Privacy Policy. Where required by law, we will provide additional notice of material changes.
        </p>

        {/* ── 38 ── */}
        <h2>38. Contact Us</h2>
        <p>
          Questions, complaints, privacy requests, data-access requests, correction requests, data-portability
          requests, deletion requests, or inquiries about Third-Party Vendor data may be directed to:
        </p>
        <p>
          <strong>[LEGAL COMPANY NAME]</strong> d/b/a <strong>PrintifyPlatform</strong><br />
          [BUSINESS ADDRESS], [CITY, STATE ZIP], United States<br />
          Privacy: <a href="mailto:privacy@printifyplatform.com">privacy@printifyplatform.com</a><br />
          Support: <a href="mailto:support@printifyplatform.com">support@printifyplatform.com</a>
        </p>
        <p>For privacy-related requests, please use the subject line: <strong>Privacy Request</strong></p>

        {/* ── 39 ── */}
        <h2>39. Merchant Acknowledgment of Third-Party API Processing</h2>
        <p>By connecting a Third-Party Vendor account to the Platform, you acknowledge that:</p>
        <ul>
          <li>you maintain or are authorized to use the connected vendor account;</li>
          <li>you have authorized the Platform to access information from that account;</li>
          <li>the Platform may process Vendor Credentials as necessary to maintain the connection;</li>
          <li>Merchant Data may be obtained from the connected vendor and used to provide the requested Services;</li>
          <li>certain information may be transmitted back to the connected vendor to perform requested functions;</li>
          <li>the Third-Party Vendor maintains independent privacy practices;</li>
          <li>you may disconnect supported integrations; and</li>
          <li>applicable vendor-derived data will be deleted according to this Privacy Policy, applicable law, and applicable vendor requirements.</li>
        </ul>

        {/* ── 40 ── */}
        <h2>40. Summary of Printify Data Practices</h2>
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#13131A] p-6 not-prose space-y-4">
          {[
            {
              label: 'Information We May Access',
              value: 'Printify shop information, product information, product variants, images, pricing, order information, shipping information, fulfillment information, customer/order data where necessary, webhook information, and authorized account metadata.',
            },
            {
              label: 'Why We Access It',
              value: 'To synchronize products, display your storefront, transmit orders, retrieve order and fulfillment status, maintain integrations, and provide merchant dashboard functionality.',
            },
            {
              label: 'How We Obtain It',
              value: 'Through authorization granted by the Printify merchant account owner, including supported Personal Access Token or OAuth authorization mechanisms.',
            },
            {
              label: 'Who We Share It With',
              value: 'Only service providers necessary to operate the Platform, applicable Third-Party Vendors necessary to perform requested services, or others where authorized or legally required.',
            },
            {
              label: 'Do We Sell It?',
              value: 'No.',
            },
            {
              label: 'How Long We Keep It',
              value: 'Only as long as reasonably necessary to provide the Services. Printify-derived Merchant Data will generally be deleted within thirty (30) days after disconnection, when no longer necessary, or following an enforceable deletion request, except where lawful retention is permitted or required.',
            },
            {
              label: 'How to Request Access, Correction, or Deletion',
              value: 'Contact privacy@printifyplatform.com',
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-[#6C47FF] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm text-[#A0A0B0]">{value}</p>
            </div>
          ))}
        </div>

        {/* ── 41 ── */}
        <h2>41. Acceptance</h2>
        <p>
          By creating a Platform account, starting a free trial, using a hosted storefront, connecting a Third-Party
          Vendor, or otherwise using the Services, you acknowledge that you have been provided access to this Privacy
          Policy and understand the data practices described above.
        </p>
      </div>
    </div>
  );
}
