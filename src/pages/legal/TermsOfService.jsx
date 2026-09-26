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

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] text-slate-700">
      <SEO
        title="Terms of Service | Verronex"
        description="Read the terms of service for using Verronex, including wallet security, third-party network reliance, user input accuracy, and account suspension rules."
        canonical="https://verronex.com/terms-of-service"
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
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">
              Effective date: 26 September 2026
            </p>
          </header>

          <div className="space-y-6 text-sm leading-7 text-slate-600 sm:text-base">
            <p>
              These Terms of Service (“Terms”) govern your access to and use of
              Verronex, a Nigerian Virtual Top-Up (VTU) and wallet service. By
              creating an account, funding a wallet, or purchasing airtime,
              data, or other digital utility services through Verronex, you
              agree to be bound by these Terms.
            </p>
            <p>
              You must be at least 18 years old and legally capable of entering
              into binding contracts under Nigerian law to use Verronex. By
              creating an account, you confirm that you meet this eligibility
              requirement.
            </p>
            <p>
              Verronex provides an intermediary platform for purchasing digital
              services and wallet-based transactions. We are not a telecom
              operator, electricity provider, financial institution, or payment
              processor, and we do not guarantee uninterrupted service by
              third-party operators or infrastructure providers.
            </p>
          </div>

          <Section title="1. Account and Wallet Security">
            <p>
              You are solely responsible for securing your account, including
              your Google OAuth login credentials, device access, and any
              recovery or authentication information linked to your Verronex
              account.
            </p>
            <p>
              Verronex is not liable for unauthorized wallet usage, completed
              transactions, or losses arising from account compromise, device
              theft, phishing, credential leakage, or any other action that
              allows a third party to access your account without your consent.
            </p>
            <p>
              If your account is compromised, you must notify Verronex promptly
              and take reasonable steps to secure your wallet. However, you
              remain responsible for all wallet activity that occurs while your
              account is accessible to you or to a third party through your
              negligence or failure to protect your login methods.
            </p>
          </Section>

          <Section title="2. Reliance on Third-Party Networks and Providers">
            <p>
              Verronex acts as an intermediary between users and third-party
              service providers such as telecom operators (including MTN,
              Airtel, Glo, 9mobile, and others), electricity distribution
              companies (“DisCos”), and other digital service providers — in
              each case, only where such services are offered on the platform
              from time to time.
            </p>
            <p>
              We do not control, own, or operate the underlying networks or
              infrastructure used to deliver data, airtime, electricity
              vouchers, or similar digital services. As a result, Verronex is
              not liable for delays, outages, service degradation, processing
              failures, downtime, or partial or failed delivery caused by
              telecom providers, DisCos, network congestion, power instability,
              system outages, maintenance, or any other external factor beyond
              our reasonable control.
            </p>
            <p>
              Any transaction may be affected by the availability or performance
              of external networks. We will use reasonable efforts to report,
              monitor, and resolve issues, but we do not guarantee successful
              completion of a top-up, purchase, or utility transaction in every
              case.
            </p>
          </Section>

          <Section title="3. User Input Responsibility">
            <p>
              You are fully responsible for ensuring that all information
              provided to Verronex is accurate before submitting a transaction.
              This includes phone numbers, meter numbers or smartcard numbers
              (where electricity or TV services are offered), account
              identifiers, and all other details required for service
              fulfillment.
            </p>
            <p>
              You must verify the destination number or account details before
              confirming any purchase. Verronex is not responsible for funds
              sent to the wrong number, wrong meter, or invalid smartcard due to
              incorrect or mistyped information entered by the user.
            </p>
            <p>
              We do not offer reverse transactions for user-caused errors. If a
              purchase is sent to an incorrect destination because the user
              entered the wrong details, the transaction is deemed final unless
              otherwise specifically resolved under a separate documented
              exception, which may be applied at Verronex’s discretion and only
              where the facts support a clear administrative error on our side.
            </p>
          </Section>

          <Section title="4. Account Suspension, Wallet Freezing, and Termination">
            <p>
              Verronex reserves the right to freeze wallets, restrict account
              access, or terminate a user account if we reasonably suspect
              fraud, chargeback abuse, API abuse, unauthorized exploitation,
              automated misuse, account takeover, suspicious transaction
              patterns, or any other conduct that violates these Terms or
              applicable law.
            </p>
            <p>
              We may also suspend or terminate access where required to protect
              the integrity of our platform, our users, or our third-party
              service partners. In such cases, we may investigate and recover
              funds or reverse transactions only as permitted by our internal
              policies and applicable law.
            </p>
            <p>
              If an account is flagged for review, we may request additional
              verification or documentation before allowing continued use of the
              platform.
            </p>
          </Section>

          <Section title="5. Transaction Accuracy and Service Delivery">
            <p>
              Verronex attempts to process each transaction promptly, but all
              purchases are subject to the technical and operational reliability
              of our platform and the underlying provider systems. We do not
              guarantee the real-time or guaranteed completion of every service
              request.
            </p>
            <p>
              We may cancel, delay, reject, or reverse a transaction where a
              technical issue, security review, or regulatory concern arises.
              Any such action will be taken in line with our operational
              policies and applicable law.
            </p>
          </Section>

          <Section title="6. Limitation of Liability">
            <p>
              To the maximum extent permitted by Nigerian law, Verronex shall
              not be liable for indirect, incidental, consequential, special,
              punitive, or loss-of-business damages arising from the use of our
              platform, including delays, failed purchases, lost service access,
              or any loss resulting from third-party network performance, user
              error, account compromise, or force majeure conditions.
            </p>
            <p>
              Our total liability, if any, shall not exceed the fees paid for
              the affected transaction, except where liability is expressly
              required by law and cannot be excluded.
            </p>
          </Section>

          <Section title="7. Changes to These Terms">
            <p>
              Verronex may update or revise these Terms from time to time.
              Continued use of the platform after any amendments constitutes
              your acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="8. Contact and Support">
            <p>
              If you have questions about these Terms, please contact Verronex
              support through the in-app “Message Us” option, by email at
              godfreyakpugo@gmail.com, by phone or WhatsApp at 0814 018 1282,
              or at No. 4 Chris Eruchie Crescent, Phase 6 Extension, Trans
              Ekulu, Enugu, Nigeria.
            </p>
          </Section>

          <Section title="9. Governing Law and Dispute Resolution">
            <p>
              These Terms are governed by the laws of the Federal Republic of
              Nigeria. Where a dispute arises in connection with your use of
              Verronex, both parties shall first attempt to resolve it amicably
              through our support channels within 30 days of the dispute being
              reported.
            </p>
            <p>
              If the dispute is not resolved amicably, it shall be subject to
              the exclusive jurisdiction of the courts of Lagos State, Nigeria,
              except where applicable law grants you the right to seek redress
              before another competent court or tribunal.
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
              to="/privacy-policy"
              className="font-semibold text-slate-700 hover:text-slate-900"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
