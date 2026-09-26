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

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)] text-slate-700">
      <SEO
        title="Refund Policy | Verronex"
        description="Read Verronex’s strict digital refund policy covering final sales, failed deductions, and dispute reporting windows."
        canonical="https://verronex.com/refund-policy"
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
              Refund Policy
            </h1>
            <p className="mt-3 text-sm text-slate-500 sm:text-base">
              Strictly digital goods and wallet-based transactions
            </p>
          </header>

          <div className="space-y-6 text-sm leading-7 text-slate-600 sm:text-base">
            <p>
              Verronex operates a digital services platform. Our products
              include airtime, data bundles, and other electronically delivered
              utility vouchers. These are digital goods and as such are subject
              to strict refund rules.
            </p>
            <p>
              By using Verronex, you agree that all digital purchases are final
              once the relevant transaction has been successfully dispensed by
              the telecom operator or service provider.
            </p>
          </div>

          <Section title="1. Finality of Sales">
            <p>
              Once a transaction is successfully processed and delivered by the
              telecom operator, electricity provider, or other downstream
              service partner, the sale is considered final. Digital products
              cannot be returned or exchanged in the same manner as physical
              goods.
            </p>
            <p>
              This applies even where the customer later changes their mind,
              makes an input error, or determines that the service was not
              needed. We do not offer cash refunds or reimbursements for
              successfully delivered digital products.
            </p>
          </Section>

          <Section title="2. Failed Transactions and Wallet Credits">
            <p>
              If a transaction fails after a deduction has been made from the
              user’s wallet, Verronex will credit the corresponding amount back
              to the user’s Verronex wallet, not to their bank account.
            </p>
            <p>
              Wallet credits are applied as internal account balance adjustments
              and may be used for future purchases on the platform. We do not
              issue direct bank transfers for failed digital transactions unless
              required by law or as otherwise explicitly stated in a separate
              policy.
            </p>
            <p>
              If the failure was caused by a provider outage, network delay, or
              system error, we will review the transaction and may refund the
              value back to the wallet in accordance with our operational
              procedures.
            </p>
          </Section>

          <Section title="3. Dispute Reporting Window">
            <p>
              If a user does not receive a purchased top-up or service credit,
              the user must report the issue within 24 to 48 hours of the
              transaction. Prompt reporting helps us investigate the transaction
              with the provider and determine whether a provider-side failure or
              processing issue occurred.
            </p>
            <p>
              Delayed reports may be denied because the operator or service
              provider may be unable to verify or reverse the transaction after
              a certain period. It is therefore important that users monitor
              their purchase status promptly and contact support as soon as
              possible.
            </p>
          </Section>

          <Section title="4. Cases Not Eligible for Refund">
            <p>Refunds are generally not available for:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Successfully delivered airtime or data bundles.</li>
              <li>
                Transactions sent to the wrong number due to user input error.
              </li>
              <li>
                Transactions canceled after provider confirmation or
                fulfillment.
              </li>
              <li>
                Service issues caused by third-party network conditions outside
                our control.
              </li>
            </ul>
          </Section>

          <Section title="5. Review and Resolution">
            <p>
              Verronex may review each dispute on a case-by-case basis. We
              reserve the right to determine whether a transaction qualifies for
              a wallet credit or other resolution based on evidence, provider
              logs, and the facts surrounding the transaction.
            </p>
            <p>
              Unless otherwise required by law, this policy is the governing
              rule for refunds related to digital transactions on the platform.
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
