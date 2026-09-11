import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — PrintifyPlatform',
  description: 'Terms of Service and Merchant Agreement for PrintifyPlatform.',
};

export default function TermsPage() {
  return (
    <div className="pt-24 pb-24 max-w-3xl mx-auto px-6">
      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service and Merchant Agreement</h1>
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
          These Terms of Service and Merchant Agreement (&quot;Agreement&quot;) constitute a legally binding agreement
          between <strong>[LEGAL COMPANY NAME]</strong>, doing business as <strong>PrintifyPlatform</strong>{' '}
          (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), and the individual, business,
          organization, or other legal entity that creates an account, subscribes to, accesses, or uses the Platform
          (&quot;Merchant,&quot; &quot;User,&quot; &quot;you,&quot; or &quot;your&quot;).
        </p>
        <p>
          This Agreement governs your access to and use of our websites, software, hosted storefronts, dashboards,
          integrations, API connections, ecommerce functionality, order-management functionality, and related services
          (collectively, the &quot;Platform&quot; or &quot;Services&quot;).
        </p>
        <p>
          By creating an account, connecting a third-party vendor account, starting a trial, purchasing a subscription,
          clicking &quot;I Agree,&quot; or otherwise accessing or using the Services, you acknowledge that you have
          read, understood, and agree to be bound by this Agreement and our Privacy Policy.
        </p>
        <p>
          If you are accepting this Agreement on behalf of a company or other legal entity, you represent and warrant
          that you have authority to bind that entity to this Agreement.
        </p>
        <p>If you do not agree to these terms, you may not access or use the Services.</p>

        <h2>1. Description of the Services</h2>
        <p>
          The Platform provides software and technology services that may allow Merchants to create, operate, customize,
          host, and manage ecommerce storefronts and connect those storefronts with supported third-party vendors and
          service providers. Depending upon the Merchant&apos;s subscription and the features then available, the
          Services may include:
        </p>
        <ul>
          <li>hosted ecommerce storefronts;</li>
          <li>custom branding and storefront configuration;</li>
          <li>custom-domain functionality;</li>
          <li>product catalog synchronization;</li>
          <li>third-party print-on-demand integrations;</li>
          <li>payment-processing integrations;</li>
          <li>order-management tools;</li>
          <li>merchant dashboards;</li>
          <li>product and inventory synchronization;</li>
          <li>webhook processing;</li>
          <li>fulfillment-related integrations;</li>
          <li>analytics and reporting;</li>
          <li>application and API integrations;</li>
          <li>hosting and deployment; and</li>
          <li>other ecommerce, automation, or business-management functionality.</li>
        </ul>
        <p>
          The Platform is an independent software service. Unless expressly stated otherwise in writing, Company does
          not manufacture, print, package, ship, fulfill, insure, or physically handle products offered by third-party
          vendors.
        </p>

        <h2>2. Merchant Account and Eligibility</h2>
        <p>
          You must be at least eighteen (18) years old and legally capable of entering into a binding contract to use
          the Services. You agree to provide accurate, current, and complete account information and to maintain that
          information throughout your use of the Services. You are responsible for:
        </p>
        <ol>
          <li>maintaining the confidentiality and security of your Platform account;</li>
          <li>all activity conducted through your account;</li>
          <li>ensuring that individuals accessing your account are authorized to do so;</li>
          <li>maintaining accurate business and contact information; and</li>
          <li>promptly notifying Company if you suspect unauthorized access to your Platform account.</li>
        </ol>
        <p>
          You may not impersonate another person or entity or establish an account on behalf of another person or entity
          unless you have authority to do so.
        </p>

        <h2>3. Third-Party Vendor Accounts</h2>
        <p>
          The Platform may integrate with independent third-party vendors, platforms, marketplaces, payment processors,
          print-on-demand providers, shipping providers, domain providers, analytics providers, and other service
          providers (&quot;Third-Party Vendors&quot;). Supported Third-Party Vendors may include, without limitation,{' '}
          <strong>Printify</strong>, Stripe, and other ecommerce or print-on-demand providers that Company may support
          from time to time.
        </p>

        <h3>3.1 Merchant Must Maintain Individual Vendor Accounts</h3>
        <p>
          You understand and agree that <strong>you are responsible for establishing, maintaining, and controlling your
          own individual account with each Third-Party Vendor that you elect to connect to the Platform</strong>.
          Company does not provide you with a Printify account, payment-processing account, print-on-demand vendor
          account, or other third-party vendor account unless Company expressly states otherwise in writing. Your
          relationship with each Third-Party Vendor is separate from your relationship with Company and is governed by
          that Third-Party Vendor&apos;s own terms, policies, fees, requirements, restrictions, and privacy practices.
        </p>

        <h3>3.2 Merchant Must Obtain Vendor API Access</h3>
        <p>
          Where a Third-Party Vendor requires an API key, Personal Access Token, access token, OAuth authorization,
          client credential, shop identifier, webhook credential, or other authentication mechanism
          (&quot;Vendor Credentials&quot;), <strong>you are responsible for obtaining the required Vendor Credentials
          from your own authorized Third-Party Vendor account</strong>. Company does not sell, rent, sublicense, or
          provide you with ownership of a Third-Party Vendor&apos;s API credentials or API access.
        </p>

        <h3>3.3 Authorization to Use Vendor Credentials</h3>
        <p>
          By entering Vendor Credentials into the Platform, completing an OAuth or other authorization process, or
          otherwise connecting a Third-Party Vendor account, you expressly authorize Company to use those credentials
          and access the connected account solely as reasonably necessary to provide the Services you have requested.
          You represent and warrant that:
        </p>
        <ol>
          <li>the connected account belongs to you or your business, or you are otherwise authorized by the account owner to connect it;</li>
          <li>you have authority to provide or authorize the applicable Vendor Credentials;</li>
          <li>Company&apos;s use of those credentials as contemplated by the Services does not violate any agreement applicable to you; and</li>
          <li>you will use the integration in accordance with the Third-Party Vendor&apos;s applicable terms and policies.</li>
        </ol>

        <h3>3.4 Credential Security</h3>
        <p>
          Company will use commercially reasonable safeguards designed to protect Vendor Credentials under Company&apos;s
          control. Company will not knowingly expose private Vendor Credentials through publicly accessible client-side
          application code. You are responsible for protecting credentials before they are submitted to or authorized
          for use by the Platform and for promptly revoking or replacing credentials that you believe have been
          compromised. You must not provide Company with credentials that you are prohibited from sharing or authorizing
          under the applicable Third-Party Vendor&apos;s terms.
        </p>

        <h2>4. Printify Integration</h2>
        <p>If you connect a Printify account to the Platform, the following additional provisions apply.</p>

        <h3>4.1 Independent Services</h3>
        <p>
          The Platform is an independent application operated by Company. Unless expressly authorized in writing by
          Printify, Company is not Printify, is not owned or operated by Printify, and does not represent that the
          Platform is an official Printify product. Printify and its services are provided independently under
          Printify&apos;s own agreements, policies, and requirements.
        </p>

        <h3>4.2 Merchant Authorization</h3>
        <p>
          By connecting your Printify account, providing an authorized Personal Access Token, completing an available
          authorization process, or otherwise authorizing the connection, you expressly authorize Company to access your
          applicable Printify shop and Merchant Data solely for purposes reasonably necessary to provide the
          Platform&apos;s services to you. You represent and warrant that you are the applicable Printify account owner
          or have express authorization from the account owner to grant such access.
        </p>

        <h3>4.3 Company Responsibility for the Platform</h3>
        <p>
          Company is solely responsible for the development, operation, maintenance, support, and functionality of the
          Platform. Printify is not responsible for faults, errors, interruptions, security incidents, performance
          issues, or other problems caused by the Platform. Questions or complaints concerning the Platform must be
          directed to Company rather than Printify.
        </p>

        <h3>4.4 Printify Services</h3>
        <p>
          Company does not control Printify&apos;s systems, APIs, manufacturing providers, product availability,
          fulfillment operations, shipping services, pricing, account policies, or other Printify services. Company
          therefore cannot guarantee the availability, accuracy, performance, or continued operation of any Printify
          service or integration. Your use of Printify remains subject to the terms, policies, requirements, and
          restrictions established by Printify.
        </p>

        <h3>4.5 Printify Data</h3>
        <p>
          Company will access, use, store, and process data obtained through the Printify integration only as reasonably
          necessary to provide the Services, as otherwise authorized by you, or as permitted or required by applicable
          law. Company is responsible for its access to, use of, distribution of, and storage of Merchant Data obtained
          through the Platform.
        </p>

        <h2>5. Third-Party Service Availability</h2>
        <p>
          Third-Party Vendors are independent from Company. Company does not control and is not responsible for changes
          to third-party APIs, API rate limits, API outages, discontinued API endpoints, authentication changes, expired
          or revoked credentials, vendor account suspensions, changes in vendor pricing, product availability, printing
          or manufacturing quality, fulfillment delays, carrier delays, shipping errors, marketplace restrictions,
          payment-processor holds, vendor policy changes, or termination or suspension of a Third-Party Vendor&apos;s
          services. Company may modify, suspend, replace, or discontinue an integration if a Third-Party Vendor changes
          or terminates functionality required by the Platform.
        </p>

        <h2>6. Merchant Data</h2>
        <p>
          &quot;Merchant Data&quot; means information submitted to the Platform by or on behalf of Merchant or obtained
          from an authorized Third-Party Vendor account in connection with Merchant&apos;s use of the Services. Merchant
          retains its rights in Merchant Data, subject to the rights necessary for Company to provide the Services.
          Merchant grants Company a limited, non-exclusive right to host, access, process, reproduce, transmit, modify,
          and otherwise use Merchant Data solely as reasonably necessary to provide and maintain the Services, operate
          requested integrations, process Merchant instructions, secure and troubleshoot the Platform, comply with
          applicable law, and perform other activities expressly authorized by Merchant. Company will not sell Merchant
          Data obtained through a Third-Party Vendor integration.
        </p>

        <h2>7. Customer Data and Privacy</h2>
        <p>
          Merchant may receive or process information concerning its customers through the Platform. Merchant remains
          responsible for its relationship with its customers and for ensuring that its collection and use of customer
          information complies with applicable law. Merchant is responsible for maintaining an appropriate privacy
          policy for its storefront and providing legally required notices to its customers. Merchant must obtain any
          consent required by law for the collection, use, processing, or transfer of customer information.
        </p>

        <h2>8. Data Retention and Disconnection</h2>
        <p>
          When you disconnect a Third-Party Vendor integration, terminate your account, or request deletion of
          applicable data, Company may delete Vendor Credentials and vendor-derived data in accordance with applicable
          law, Company&apos;s Privacy Policy, and legitimate legal, security, fraud-prevention, accounting, or
          compliance obligations. Disconnecting an integration may cause products, orders, fulfillment information, or
          other functionality dependent upon that integration to stop working.
        </p>

        <h2>9. Merchant Products and Content</h2>
        <p>
          Merchant is solely responsible for the products, designs, images, trademarks, descriptions, pricing,
          advertising, claims, and other content Merchant makes available through the Platform
          (&quot;Merchant Content&quot;). Merchant represents and warrants that it owns Merchant Content or possesses
          all rights, licenses, permissions, and authorizations necessary to use, reproduce, display, sell, manufacture,
          and distribute it. Merchant may not use the Platform to offer products or content that infringes intellectual
          property rights, violates privacy or publicity rights, is fraudulent or deceptive, violates applicable law,
          contains malicious software, facilitates unlawful conduct, or violates applicable Third-Party Vendor policies.
        </p>

        <h2>10. Merchant&apos;s Responsibility for Its Business</h2>
        <p>
          The Platform provides technology and software services. Merchant remains the seller or business operator
          responsible for its storefront and business activities, including determining products offered for sale,
          product descriptions, retail prices, taxes, refunds, returns, customer-service obligations, regulatory
          compliance, advertising claims, intellectual property rights, customer communications, fulfillment decisions,
          business licenses, sales-tax registrations, product-specific disclosures, and compliance with laws applicable
          to Merchant&apos;s business. Company does not provide legal, tax, accounting, or financial advice.
        </p>

        <h2>11. Orders and Fulfillment</h2>
        <p>
          Where supported, the Platform may transmit customer orders to a connected Third-Party Vendor for processing
          or fulfillment. Merchant authorizes Company to transmit order information to the applicable Third-Party Vendor
          when necessary to perform the requested Services. Merchant remains responsible for reviewing orders and
          ensuring that sufficient funds, billing arrangements, product configurations, shipping information, and
          vendor-account settings exist for fulfillment. Company does not guarantee that a Third-Party Vendor will
          accept, manufacture, fulfill, or timely deliver an order.
        </p>

        <h2>12. Payment Processing</h2>
        <p>
          The Platform may integrate with independent payment processors such as Stripe. Payment-processing services are
          provided by the applicable payment processor and are subject to that provider&apos;s separate terms. Merchant
          is responsible for establishing and maintaining any required payment-processing account. Company is not a
          bank, card network, or payment processor unless expressly stated otherwise. Company is not responsible for
          payment holds, reserves, chargebacks, declined transactions, processor account suspensions, or other actions
          taken independently by a payment processor.
        </p>

        <h2>13. Subscriptions, Fees, and Free Trials</h2>
        <p>
          Certain Services may require payment of recurring subscription fees. Current subscription fees, features,
          billing periods, and trial terms will be disclosed at signup or on the Platform&apos;s pricing page. By
          purchasing a paid subscription, you authorize Company or its payment processor to charge the applicable
          recurring fees and taxes using your selected payment method. Unless otherwise disclosed at signup,
          cancellation prevents future subscription renewals but does not retroactively refund charges already incurred.
          Company may change subscription pricing upon reasonable advance notice where required by applicable law.
        </p>

        <h2>14. Acceptable Use</h2>
        <p>Merchant may not:</p>
        <ol>
          <li>use the Platform for unlawful or fraudulent purposes;</li>
          <li>attempt unauthorized access to Company or Third-Party Vendor systems;</li>
          <li>circumvent API limits, authentication mechanisms, or security controls;</li>
          <li>reverse engineer the Platform except where such restriction is prohibited by law;</li>
          <li>introduce malware or harmful code;</li>
          <li>interfere with the operation of the Platform;</li>
          <li>use Vendor Credentials belonging to another person without authorization;</li>
          <li>scrape or access Third-Party Vendor data beyond authorized functionality;</li>
          <li>misrepresent Merchant&apos;s identity or authority;</li>
          <li>use the Platform to violate a Third-Party Vendor&apos;s applicable terms;</li>
          <li>resell or sublicense access to a Third-Party Vendor API except where expressly authorized; or</li>
          <li>use the Platform in a manner reasonably likely to damage Company, another Merchant, a Third-Party Vendor, or customers.</li>
        </ol>

        <h2>15. Intellectual Property</h2>
        <p>
          Except for Merchant Content and third-party materials, Company and its licensors retain all rights, title, and
          interest in the Platform, including its software, source code, interfaces, designs, documentation, workflows,
          databases, trademarks, and proprietary technology. This Agreement does not transfer ownership of Company
          intellectual property to Merchant. Company grants Merchant a limited, revocable, non-exclusive,
          non-transferable license to use the Platform during an active subscription solely for Merchant&apos;s
          legitimate business purposes and in accordance with this Agreement.
        </p>

        <h2>16. No Affiliation or Endorsement</h2>
        <p>
          References to third-party products, vendors, platforms, trademarks, or services identify compatible or
          integrated services and do not by themselves imply sponsorship, endorsement, ownership, partnership, agency,
          or affiliation. Unless Company expressly states otherwise based upon written authorization, Company is an
          independent software provider.
        </p>

        <h2>17. Service Modifications</h2>
        <p>
          Company may periodically add, modify, replace, or discontinue Platform functionality as necessary to maintain
          security, comply with applicable law, respond to API changes, comply with Third-Party Vendor requirements,
          improve Platform functionality, address technical limitations, or discontinue unsupported integrations. Where
          commercially reasonable, Company will attempt to provide advance notice of material changes that substantially
          affect paid Services.
        </p>

        <h2>18. Suspension and Termination</h2>
        <p>
          Company may suspend or terminate Merchant&apos;s access to all or part of the Services if Merchant materially
          violates this Agreement, fails to pay applicable fees, engages in fraudulent or unlawful activity, creates a
          material security risk, uses unauthorized Vendor Credentials, violates applicable Third-Party Vendor
          requirements, or creates material risk to Company or another user. Termination of the Platform does not
          automatically terminate Merchant&apos;s independent accounts with Third-Party Vendors.
        </p>

        <h2>19. Effect of Third-Party API Termination</h2>
        <p>
          Merchant acknowledges that integrations depend upon continued access to Third-Party Vendor APIs. If a
          Third-Party Vendor suspends, terminates, restricts, or materially modifies Company&apos;s API access,
          affected Platform functionality may become unavailable. Company will not be responsible for the independent
          decision of a Third-Party Vendor to suspend, restrict, modify, or discontinue its API or services, except to
          the extent liability cannot lawfully be excluded.
        </p>

        <h2>20. Disclaimer of Warranties</h2>
        <p className="uppercase text-xs tracking-wide">
          To the maximum extent permitted by law, the Platform and Services are provided &quot;as is&quot; and &quot;as
          available.&quot; Company does not warrant that the Platform will be uninterrupted, error-free, completely
          secure, or compatible with every third-party service. Company does not warrant or guarantee sales, revenue,
          conversion rates, search-engine rankings, customer acquisition, profitability, or other business results.
          Company disclaims warranties of merchantability, fitness for a particular purpose, and non-infringement to
          the maximum extent permitted by applicable law. Some jurisdictions do not permit certain warranty exclusions,
          so portions of this section may not apply to you.
        </p>

        <h2>21. Limitation of Liability</h2>
        <p className="uppercase text-xs tracking-wide">
          To the maximum extent permitted by applicable law, Company and its officers, directors, employees, affiliates,
          contractors, and agents will not be liable for indirect, incidental, special, exemplary, punitive, or
          consequential damages, including lost profits, lost revenue, lost business opportunities, loss of goodwill, or
          loss of data, arising from or related to the Services. To the maximum extent permitted by law, Company&apos;s
          aggregate liability arising out of or relating to the Services or this Agreement will not exceed the greater
          of: (A) the amount paid by Merchant to Company during the six (6) months immediately preceding the event
          giving rise to the claim; or (B) one hundred U.S. dollars ($100). The limitations in this Section do not
          apply where such limitation is prohibited by applicable law.
        </p>

        <h2>22. Merchant Indemnification</h2>
        <p>
          To the extent permitted by applicable law, Merchant agrees to defend, indemnify, and hold harmless Company
          and its officers, directors, employees, affiliates, contractors, and agents from third-party claims, damages,
          liabilities, judgments, losses, and reasonable legal expenses arising from or relating to Merchant&apos;s
          products or services, Merchant Content, Merchant&apos;s violation of applicable law, Merchant&apos;s
          infringement of third-party rights, Merchant&apos;s unauthorized use of Vendor Credentials, Merchant&apos;s
          breach of this Agreement, Merchant&apos;s customer relationships, Merchant&apos;s taxes, refunds, returns, or
          product obligations, or Merchant&apos;s misuse of the Platform.
        </p>

        <h2>23. Third-Party Beneficiary Protection</h2>
        <p>
          To the extent required by the terms governing a Third-Party Vendor integration, Merchant acknowledges that
          the applicable Third-Party Vendor bears no responsibility for Company&apos;s independent Platform or
          Company&apos;s relationship with Merchant. Nothing in this Agreement creates an obligation for a Third-Party
          Vendor to support, maintain, repair, or compensate Merchant for Company&apos;s Platform.
        </p>

        <h2>24. Changes to These Terms</h2>
        <p>
          Company may update this Agreement periodically to reflect changes in the Services, law, security requirements,
          business operations, or Third-Party Vendor requirements. The revised Agreement will identify its effective or
          last-updated date. Where required by applicable law, Company will provide notice of material changes.
          Continued use of the Services after an updated Agreement becomes effective constitutes acceptance of the
          revised Agreement to the extent permitted by applicable law.
        </p>

        <h2>25. Electronic Communications</h2>
        <p>
          Merchant consents to receive transactional and administrative communications electronically, including account
          notices, billing notices, security notices, integration notices, and changes affecting the Services. Merchant
          is responsible for maintaining a current email address.
        </p>

        <h2>26. Governing Law</h2>
        <p>
          This Agreement will be governed by and construed in accordance with the laws of the State of{' '}
          <strong>[STATE]</strong>, without regard to its conflict-of-laws principles. Subject to any arbitration
          provision adopted by Company, any legal action arising out of or relating to this Agreement will be brought
          in the state or federal courts located in <strong>[COUNTY, STATE]</strong>, and each party consents to the
          jurisdiction and venue of those courts.
        </p>

        <h2>27. Severability</h2>
        <p>
          If any provision of this Agreement is determined to be invalid or unenforceable, that provision will be
          enforced to the maximum extent permitted by law, and the remaining provisions will remain in full force and
          effect.
        </p>

        <h2>28. No Waiver</h2>
        <p>
          Failure by Company to enforce any provision of this Agreement does not constitute a waiver of that provision
          or Company&apos;s right to enforce it later.
        </p>

        <h2>29. Assignment</h2>
        <p>
          Merchant may not assign this Agreement without Company&apos;s prior written consent. Company may assign this
          Agreement in connection with a merger, acquisition, corporate reorganization, sale of assets, financing
          transaction, or transfer of the Platform or applicable business operations.
        </p>

        <h2>30. Entire Agreement</h2>
        <p>
          This Agreement, together with the Privacy Policy, applicable order forms, subscription terms, and any
          additional policies expressly incorporated by reference, constitutes the entire agreement between Merchant and
          Company concerning the Services and supersedes prior agreements concerning the same subject matter.
        </p>

        <h2>31. Contact Information</h2>
        <p>Questions concerning this Agreement, the Platform, privacy practices, Vendor Credentials, or Merchant Data should be directed to:</p>
        <p>
          <strong>[LEGAL COMPANY NAME]</strong> d/b/a <strong>PrintifyPlatform</strong><br />
          [BUSINESS ADDRESS], [CITY, STATE ZIP], United States<br />
          Support: <a href="mailto:support@printifyplatform.com">support@printifyplatform.com</a><br />
          Privacy: <a href="mailto:privacy@printifyplatform.com">privacy@printifyplatform.com</a>
        </p>

        <h2>32. Merchant Acknowledgment and API Authorization</h2>
        <div className="rounded-2xl border border-[#2A2A3A] bg-[#13131A] p-6 space-y-3 not-prose">
          {[
            'I maintain or am authorized to use the Third-Party Vendor accounts that I connect to the Platform.',
            'I understand that I am responsible for obtaining API credentials or authorization from my own individual Third-Party Vendor account, including my own Printify account when I choose to connect Printify.',
            'I expressly authorize PrintifyPlatform to access my connected Third-Party Vendor accounts and process applicable Merchant Data solely as reasonably necessary to provide the Services I request.',
            'I understand that PrintifyPlatform is an independent software provider and, unless expressly stated otherwise, is not owned, operated, sponsored, or endorsed by Printify or any other Third-Party Vendor.',
            "I understand that Third-Party Vendors maintain their own terms, privacy policies, fees, account requirements, and service availability, and that I remain responsible for complying with those requirements.",
            'I have read and agree to these Terms of Service and Merchant Agreement and the Company\'s Privacy Policy.',
          ].map((item, i) => (
            <p key={i} className="flex gap-3 text-sm text-[#A0A0B0]">
              <span className="text-[#6C47FF] font-bold shrink-0">✓</span>
              {item}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
