import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function CancellationRefundPolicyPage() {
  return (
    <LegalPolicyPage
      title="Cancellation & Refund Policy"
      lastUpdated="August 14, 2026"
      description="This Cancellation & Refund Policy explains how cancellations, subscription renewals, plan upgrades, plan downgrades, failed payments, duplicate charges, refund requests, and related billing matters are handled for EveBash Services. This Policy should be read together with the EveBash Terms & Conditions and Privacy Policy. Where applicable law provides consumers with additional cancellation, refund, or grievance rights, those rights will continue to apply."
      sections={[
        {
          title: "1. EveBash Plans",
          content: (
            <>
              <p>EveBash may offer:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>free plans;</li>
                <li>monthly paid plans;</li>
                <li>annual paid plans;</li>
                <li>promotional plans;</li>
                <li>storage-based plans;</li>
                <li>business plans;</li>
                <li>event-related plans; and</li>
                <li>other paid features or add-ons.</li>
              </ul>
              <p>Each plan may have different limits relating to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>storage;</li>
                <li>number of events;</li>
                <li>gallery creation;</li>
                <li>business listings;</li>
                <li>uploads;</li>
                <li>image/video features;</li>
                <li>Find You functionality;</li>
                <li>collaboration;</li>
                <li>downloads;</li>
                <li>analytics; and</li>
                <li>other EveBash Services.</li>
              </ul>
              <p>
                The applicable price, billing period, plan limits, and included features will be displayed before purchase.
              </p>
            </>
          ),
        },
        {
          title: "2. Cancelling a Paid Plan",
          content: (
            <>
              <p>
                You may cancel or stop renewal of an eligible EveBash paid plan through your account settings where this option is available.
              </p>
              <p>
                You may also request assistance by contacting: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a>.
              </p>
              <p>Cancellation generally prevents the next renewal charge.</p>
              <p>
                Unless otherwise stated for a specific plan, cancellation does <strong>not automatically terminate the remaining paid subscription period</strong>.
              </p>
              <p>
                For example, if you purchase a monthly plan and cancel halfway through the billing month, you may continue using eligible paid features until the end of that paid billing period.
              </p>
              <p>After the paid period ends, your account may:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>move to the applicable free plan;</li>
                <li>move to another plan you selected;</li>
                <li>lose access to certain paid features; or</li>
                <li>become subject to lower storage or usage limits.</li>
              </ul>
            </>
          ),
        },
        {
          title: "3. Automatic Renewal",
          content: (
            <>
              <p>
                Where an EveBash subscription is configured to renew automatically, the subscription will continue for the applicable billing period until cancelled.
              </p>
              <p>
                Before purchasing an automatically renewing plan, EveBash will display the relevant billing frequency and renewal information.
              </p>
              <p>
                Where supported by the payment provider, renewal payments may be processed using the payment authorization established when the subscription was created.
              </p>
              <p>
                Users should cancel before the next scheduled renewal if they do not want the subscription to renew.
              </p>
              <p>
                Where required by applicable law, EveBash will provide appropriate information or notice relating to recurring billing.
              </p>
            </>
          ),
        },
        {
          title: "4. Effect of Cancellation",
          content: (
            <>
              <p>Cancelling a subscription does not necessarily delete:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>your EveBash account;</li>
                <li>your events;</li>
                <li>your galleries;</li>
                <li>your photographs;</li>
                <li>your videos;</li>
                <li>your business profile; or</li>
                <li>other account information.</li>
              </ul>
              <p>
                Instead, cancellation normally affects the plan and features available after the active paid period ends.
              </p>
              <p>
                Different rules may apply where a user separately requests account deletion. Account deletion is governed by EveBash's Privacy Policy and applicable data-retention rules.
              </p>
            </>
          ),
        },
        {
          title: "5. Plan Upgrades",
          content: (
            <>
              <p>Users may upgrade to a higher EveBash plan where available.</p>
              <p>A plan upgrade may provide additional:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>storage;</li>
                <li>events;</li>
                <li>gallery capacity;</li>
                <li>business features;</li>
                <li>media-processing features;</li>
                <li>AI features;</li>
                <li>collaboration features; or</li>
                <li>other functionality.</li>
              </ul>
              <p>
                Where technically supported, an upgrade may take effect <strong>immediately after successful payment confirmation</strong>.
              </p>
              <p>
                EveBash will not rely solely on a frontend payment-success message. The upgrade may be activated only after EveBash receives reliable confirmation from the applicable payment provider.
              </p>
            </>
          ),
        },
        {
          title: "6. Upgrade Pricing",
          content: (
            <>
              <p>The amount charged for an upgrade may depend on the billing model used by EveBash.</p>
              <p>Depending on the plan, EveBash may:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>charge the full price of the new plan;</li>
                <li>charge a prorated difference;</li>
                <li>apply an account credit;</li>
                <li>replace the existing billing period; or</li>
                <li>schedule the higher plan for the next billing cycle.</li>
              </ul>
              <p>
                The applicable upgrade price and effective date should be displayed before the user confirms the upgrade. EveBash should not apply an undisclosed upgrade charge.
              </p>
            </>
          ),
        },
        {
          title: "7. Plan Downgrades",
          content: (
            <>
              <p>A downgrade normally moves an account from a higher plan to a lower plan.</p>
              <p>
                Unless otherwise stated, EveBash intends to apply downgrades at the <strong>end of the current paid billing period</strong> rather than immediately.
              </p>
              <p>
                This allows users to continue using storage and features they already paid for during the current period.
              </p>
              <p>
                Example: If a user has a 500 GB plan valid until September 30 and schedules a downgrade to 100 GB on September 10, the 500 GB plan may remain active until September 30 and the 100 GB limit may begin on October 1.
              </p>
            </>
          ),
        },
        {
          title: "8. Storage After a Downgrade",
          content: (
            <>
              <p>
                This section is particularly important for EveBash because plans may include different storage limits.
              </p>
              <p>
                If the amount of media stored in an account exceeds the storage allowance of the downgraded plan, EveBash may:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>temporarily restrict new uploads;</li>
                <li>restrict creation of additional media;</li>
                <li>notify the account holder that storage exceeds the new limit;</li>
                <li>allow the user to remove or download eligible media;</li>
                <li>allow the user to upgrade again; or</li>
                <li>apply another reasonable storage-management process.</li>
              </ul>
              <p>
                EveBash should not intentionally delete valuable user media immediately merely because a downgrade takes effect, unless a separate policy, notice, or legal requirement clearly provides otherwise.
              </p>
              <p>
                Where EveBash intends to delete content because an account remains above its storage allowance for an extended period, the user should receive reasonable notice where practicable before deletion. The final grace period should be documented before public launch.
              </p>
            </>
          ),
        },
        {
          title: "9. Free Plan After Cancellation",
          content: (
            <>
              <p>
                If a paid subscription expires or is cancelled and the account becomes eligible for the EveBash free plan, the account will become subject to the storage and feature limits of the free plan.
              </p>
              <p>
                If existing usage exceeds those limits, certain functionality may be restricted until the user deletes eligible content, reduces usage, renews, upgrades, or otherwise brings the account within applicable limits.
              </p>
            </>
          ),
        },
        {
          title: "10. Refund Requests",
          content: (
            <>
              <p>Refund eligibility is determined according to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>applicable law;</li>
                <li>the type of purchase;</li>
                <li>payment status;</li>
                <li>billing period;</li>
                <li>whether the service was successfully activated;</li>
                <li>usage of the plan;</li>
                <li>storage or processing already consumed;</li>
                <li>duplicate or incorrect charges;</li>
                <li>technical issues attributable to EveBash;</li>
                <li>promotional terms; and</li>
                <li>other relevant circumstances.</li>
              </ul>
              <p>
                Submitting a refund request does not automatically mean the refund will be approved. EveBash will review eligible requests individually.
              </p>
            </>
          ),
        },
        {
          title: "11. Change-of-Mind Refunds",
          content: (
            <>
              <p>
                Unless otherwise stated or required by applicable law, EveBash does not guarantee a full refund solely because a user changes their mind after a paid plan has been activated and substantially used.
              </p>
              <p>This is particularly relevant where EveBash has already provided:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>storage capacity;</li>
                <li>image/video processing;</li>
                <li>gallery hosting;</li>
                <li>AI processing;</li>
                <li>downloads;</li>
                <li>business features;</li>
                <li>paid event features; or</li>
                <li>other resources associated with the purchased plan.</li>
              </ul>
              <p>
                However, EveBash may provide a refund, partial refund, credit, or other resolution at its discretion where appropriate and legally permitted.
              </p>
            </>
          ),
        },
        {
          title: "12. Unused Subscription Period",
          content: (
            <>
              <p>
                Cancelling a subscription does not automatically entitle the user to a prorated refund for unused days remaining in the current billing period unless:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>EveBash expressly states otherwise;</li>
                <li>the relevant plan provides for prorated refunds;</li>
                <li>EveBash approves the refund;</li>
                <li>there was a qualifying technical or billing issue; or</li>
                <li>applicable law requires a refund.</li>
              </ul>
              <p>
                Users will generally continue receiving the paid plan's eligible benefits until the end of the active billing period.
              </p>
            </>
          ),
        },
        {
          title: "13. Duplicate Payments",
          content: (
            <>
              <p>
                If you believe you were charged more than once for the same purchase, contact: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a>.
              </p>
              <p>Please provide information such as:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>EveBash account email;</li>
                <li>payment reference or transaction ID;</li>
                <li>payment date;</li>
                <li>amount charged; and</li>
                <li>any other information reasonably necessary to locate the transaction.</li>
              </ul>
              <p>
                Do <strong>not</strong> send full debit/credit card numbers, CVVs, banking passwords, or UPI PINs.
              </p>
              <p>
                If EveBash confirms that an unintended duplicate payment occurred, the duplicate transaction may be refunded or otherwise corrected.
              </p>
            </>
          ),
        },
        {
          title: "14. Failed Payments",
          content: (
            <>
              <p>A failed payment normally does not activate the purchased plan.</p>
              <p>Possible reasons for payment failure may include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>bank rejection;</li>
                <li>insufficient funds;</li>
                <li>expired payment authorization;</li>
                <li>network failure;</li>
                <li>payment-gateway failure;</li>
                <li>interrupted checkout;</li>
                <li>UPI timeout;</li>
                <li>risk or fraud controls; or</li>
                <li>another payment-provider issue.</li>
              </ul>
              <p>
                If money appears to have been debited but EveBash has not received confirmed payment, users should contact support with the payment reference. In some cases, the payment provider or bank may automatically reverse a failed or incomplete transaction.
              </p>
            </>
          ),
        },
        {
          title: "15. Payment Successful but Plan Not Activated",
          content: (
            <>
              <p>
                If payment succeeds but the EveBash plan does not update correctly, the user should contact: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a>.
              </p>
              <p>EveBash may verify Razorpay/payment-provider transaction status, signatures, webhooks, orders, and account records.</p>
              <p>
                If successful payment is confirmed, EveBash may activate the correct plan, repair subscription state, apply account credit, or issue a refund.
              </p>
            </>
          ),
        },
        {
          title: "16. Payment Pending",
          content: (
            <>
              <p>
                Some payment methods may remain in a pending state before final confirmation. While a payment remains pending, EveBash may delay activation of the paid plan until confirmed successful.
              </p>
              <p>
                If payment later fails, the plan will not be activated. If payment succeeds, the plan will be activated.
              </p>
            </>
          ),
        },
        {
          title: "17. Refunds for Technical Problems",
          content: (
            <>
              <p>
                A refund, account credit, plan extension, or other remedy may be considered where a significant EveBash technical problem prevented the user from receiving the paid service.
              </p>
              <p>Relevant circumstances may include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>payment succeeded but plan could not be activated;</li>
                <li>significant paid functionality remained unavailable due to an EveBash issue;</li>
                <li>a billing error occurred; or</li>
                <li>an incorrect plan was charged due to a system error.</li>
              </ul>
              <p>
                Minor interruptions, scheduled maintenance, temporary third-party outages, or issues caused by the user's own device/network do not automatically qualify for a refund.
              </p>
            </>
          ),
        },
        {
          title: "18. Partial Refunds and Credits",
          content: (
            <>
              <p>
                Where appropriate, EveBash may offer full refunds, partial refunds, account credits, subscription extensions, or plan adjustments based on unavailability duration, affected features, amount paid, and applicable law.
              </p>
            </>
          ),
        },
        {
          title: "19. Refund Method",
          content: (
            <>
              <p>
                Approved refunds will ordinarily be returned through the <strong>original payment method</strong> where technically possible.
              </p>
              <p>
                Users generally cannot request that a refund be sent to an unrelated bank account, UPI ID, card, wallet, or another person's account unless legally required.
              </p>
            </>
          ),
        },
        {
          title: "20. Refund Processing Time",
          content: (
            <>
              <p>
                After EveBash approves and initiates a refund, processing time depends on payment gateways, banks, card networks, or UPI providers. EveBash does not control third-party processing times.
              </p>
            </>
          ),
        },
        {
          title: "21. Razorpay and Other Payment Providers",
          content: (
            <>
              <p>
                EveBash may use payment providers such as Razorpay to process payments. Payment providers operate their own infrastructure and terms. A payment provider's role does not remove EveBash's obligations to address legitimate billing complaints.
              </p>
            </>
          ),
        },
        {
          title: "22. Chargebacks and Payment Disputes",
          content: (
            <>
              <p>
                If a user disputes a payment with their bank or payment provider, EveBash may provide information necessary to respond. Where a payment is reversed or charged back, EveBash may temporarily restrict the paid service while unresolved.
              </p>
            </>
          ),
        },
        {
          title: "23. Fraudulent or Abusive Refund Requests",
          content: (
            <>
              <p>
                EveBash may refuse refund requests that appear to involve fraud, intentional abuse, repeated misuse of refund processes, or false payment claims, subject to law.
              </p>
            </>
          ),
        },
        {
          title: "24. Promotional and Discounted Plans",
          content: (
            <>
              <p>
                Promotional offers may have specific eligibility, expiration, upgrade, cancellation, or refund rules disclosed before purchase.
              </p>
            </>
          ),
        },
        {
          title: "25. Add-Ons and One-Time Purchases",
          content: (
            <>
              <p>
                EveBash may offer paid add-ons or one-time purchases (extra storage, extra events, premium processing). Refund and cancellation rules for one-time purchases may differ from recurring subscriptions.
              </p>
            </>
          ),
        },
        {
          title: "26. Taxes and Fees",
          content: (
            <>
              <p>
                Approved refunds may include or exclude applicable taxes depending on tax law, invoice treatment, and gateway rules.
              </p>
            </>
          ),
        },
        {
          title: "27. Account Termination by EveBash",
          content: (
            <>
              <p>
                If EveBash terminates a paid account for a serious violation of Terms, refund eligibility depends on the reason, remaining period, and service consumed. Termination for prohibited/fraudulent activity does not guarantee a refund.
              </p>
            </>
          ),
        },
        {
          title: "28. Discontinuation of an EveBash Service",
          content: (
            <>
              <p>
                If EveBash permanently discontinues a paid service before subscription end, EveBash may provide migration, credit, extension, or refund remedies where required or reasonable.
              </p>
            </>
          ),
        },
        {
          title: "29. How to Request a Refund",
          content: (
            <>
              <p>To request review of a payment or refund issue, contact: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a>.</p>
              <p>Include: registered email, payment/order reference, purchase date, plan, amount, brief explanation, and screenshots. Do not send sensitive credentials.</p>
            </>
          ),
        },
        {
          title: "30. Review of Refund Requests",
          content: (
            <>
              <p>
                EveBash reviews refund requests based on gateway status, billing records, account activity, activation, storage/processing usage, and incident logs.
              </p>
            </>
          ),
        },
        {
          title: "31. Grievances",
          content: (
            <>
              <p>
                If a billing/refund issue has not been resolved appropriately, submit a grievance to: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a> under applicable Indian consumer-protection principles.
              </p>
            </>
          ),
        },
        {
          title: "32. Changes to This Policy",
          content: (
            <>
              <p>
                EveBash may update this Cancellation & Refund Policy as subscription models, payment systems, or legal requirements change. Revisions will update the Last updated date.
              </p>
            </>
          ),
        },
        {
          title: "33. Contact Us",
          content: (
            <>
              <p>For cancellation, billing, payment, or refund questions, contact:</p>
              <div className="mt-2 space-y-1 rounded-xl bg-[var(--site-card-muted)] p-4 text-sm">
                <p><strong>EveBash</strong></p>
                <p><strong>Email:</strong> <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a></p>
                <p><strong>Website:</strong> evebash.com</p>
              </div>
              <p className="mt-3 text-xs text-[var(--site-muted)]">
                Before public launch, EveBash should add its final legal entity name, business/registered address, and legally required grievance-contact information.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
