import { Link } from "react-router-dom";
import SEO from "../../components/seo/SEO";
import BrandLogo from "../../components/ui/BrandLogo";

function Section({ title, children }) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm sm:p-7">
      <h2 className="mb-3 text-xl font-bold text-slate-900">{title}</h2>
      <div className="space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] text-slate-700">
      <SEO
        title="Privacy Policy | Verronex"
        description="Learn how Verronex collects, stores, and uses your data under the Nigerian Data Protection Act and wallet security requirements."
        canonical="https://verronex.com/privacy-policy"
        robots="index, follow"
      />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-8 flex items-center justify-center">
          <BrandLogo size="lg" />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10">
          <header className="mb-8 border-b border-slate-200 pb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-600">
              Verronex
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">
              Effective date: 26 September 2026
            </p>
            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              This policy explains how we collect, use, protect, and share
              personal data in connection with our VTU and wallet services.
            </p>
          </header>

          <div className="space-y-6 text-sm leading-7 text-slate-600 sm:text-base">
            <p>
              Verronex is committed to protecting your privacy and processing
              your personal information responsibly in line with applicable
              Nigerian data protection obligations, including the Nigerian Data
              Protection Act (“NDPA”) and related regulations.
            </p>
            <p>
              We collect only the personal data needed to provide VTU services,
              maintain wallet ledgers, process transactions, support account
              access, prevent fraud, and comply with legal and regulatory
              requirements.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <p>
              We collect basic identity and account information such as your
              name, email address, profile details, and authentication data
              provided through Google OAuth sign-in.
            </p>
            <p>
              We also collect transaction records, wallet activity, purchase
              history, top-up details, provider references, account identifiers,
              and security-related metadata strictly to deliver our services,
              maintain accurate records, and prevent abuse or fraud.
            </p>
            <p>
              We do not collect or require unnecessary personal information
              beyond what is reasonably needed to operate the platform safely
              and reliably.
            </p>
          </Section>

          <Section title="2. How We Use Your Data">
            <p>We use the information we collect to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Provide VTU and wallet services to users.</li>
              <li>
                Process airtime, data, and utility purchases (where such
                services are offered).
              </li>
              <li>Maintain wallet balance and transaction ledgers.</li>
              <li>
                Prevent fraud, abuse, unauthorized access, and suspicious
                activity.
              </li>
              <li>
                Support customer service, account recovery, and dispute
                resolution.
              </li>
              <li>
                Comply with lawful requests, regulatory obligations, and
                internal controls.
              </li>
            </ul>
          </Section>

          <Section title="3. Payment Data and Card Information">
            <p>
              Verronex does not store raw credit card details or full payment
              card information on our systems. Payments are handled securely
              through third-party payment gateways and financial service
              providers.
            </p>
            <p>
              When you use a payment gateway or wallet funding flow, your
              payment details are processed by the relevant third-party provider
              in accordance with their own privacy and security terms. We
              receive only the information needed to confirm payment success or
              status.
            </p>
          </Section>

          <Section title="4. Wallet and Transaction Data">
            <p>
              Transaction logs are retained to maintain the integrity of our
              wallet system, reconcile balances, provide purchase records, and
              support internal auditing and investigations.
            </p>
            <p>
              We may keep records of purchases, wallet funding, refunds, failed
              transactions, service delivery outcomes, and disputes for as long
              as reasonably necessary for service operation, legal compliance,
              and anti-fraud controls.
            </p>
          </Section>

          <Section title="5. Anti-Fraud, Security, and AML Controls">
            <p>
              Verronex reserves the right to monitor wallet activity for
              suspicious patterns and to impose transaction limits or
              verification requirements when necessary. This may include
              reviewing unusual wallet behavior, unusual transfer patterns,
              multiple failed attempts, or account activity inconsistent with
              normal usage.
            </p>
            <p>
              For higher-risk or suspicious activity, we may request KYC
              documentation such as a government-issued ID or other supporting
              documents to verify identity and reduce fraud exposure.
            </p>
            <p>
              Refusal to provide requested information may result in transaction
              limits, wallet restrictions, or account review, suspension, or
              termination.
            </p>
          </Section>

          <Section title="6. Data Sharing">
            <p>
              We may share personal information with trusted third parties only
              when necessary to operate the platform, process payments, provide
              telecom or utility services, or meet legal or regulatory
              obligations.
            </p>
            <p>
              We do not sell personal data. However, we may share limited data
              with service providers, security vendors, or compliance partners
              under appropriate contractual safeguards.
            </p>
          </Section>

          <Section title="7. Data Security">
            <p>
              We use reasonable technical, administrative, and organizational
              safeguards to protect user information from unauthorized access,
              alteration, disclosure, or destruction.
            </p>
            <p>
              No system can be completely secure, and we encourage users to
              maintain secure login credentials and device security. If a
              security issue is identified, we will respond promptly and may
              notify affected users where required by law or contract.
            </p>
          </Section>

          <Section title="8. Your Rights and Choices">
            <p>
              Depending on the circumstances and applicable law, you may have
              the right to request access to, correction of, deletion of, or
              restriction on the processing of your personal information, as
              well as the right to object to some processing activities.
            </p>
            <p>
              To exercise those rights or ask questions about your data, please
              contact us through the in-app “Message Us” option, by email at
              godfreyakpugo@gmail.com, or by phone or WhatsApp at 0814 018
              1282. You also have the right to lodge a complaint with the
              Nigeria Data Protection Commission (NDPC) if you believe your
              data has been mishandled.
            </p>
          </Section>

          <Section title="9. Policy Updates">
            <p>
              Verronex may revise this Privacy Policy from time to time to
              reflect changes in our services, legal requirements, or
              operational practices. We will post the updated policy on the
              platform and continuing to use the service after the update means
              you accept the revised terms.
            </p>
          </Section>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row">
            <Link
              to="/"
              className="font-semibold text-fuchsia-700 hover:text-fuchsia-800"
            >
              Return to home
            </Link>
            <Link
              to="/terms-of-service"
              className="font-semibold text-slate-700 hover:text-slate-900"
            >
              View Terms of Service
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
