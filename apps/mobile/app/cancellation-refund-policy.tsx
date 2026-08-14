import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function CancellationRefundPolicyScreen() {
  return (
    <LegalPolicyScreen
      title="Cancellation & Refund Policy"
      lastUpdated="August 14, 2026"
      description="This Cancellation & Refund Policy explains how cancellations, subscription renewals, plan upgrades, plan downgrades, failed payments, duplicate charges, refund requests, and related billing matters are handled for EveBash Services. This Policy should be read together with the EveBash Terms & Conditions and Privacy Policy. Where applicable law provides consumers with additional cancellation, refund, or grievance rights, those rights will continue to apply."
      sections={[
        {
          title: '1. EveBash Plans',
          paragraphs: [
            'EveBash may offer: free plans; monthly paid plans; annual paid plans; promotional plans; storage-based plans; business plans; event-related plans; and other paid features or add-ons.',
            'Each plan may have different limits relating to storage, number of events, gallery creation, business listings, uploads, image/video features, Find You functionality, collaboration, downloads, analytics, and other EveBash Services.',
            'The applicable price, billing period, plan limits, and included features will be displayed before purchase.',
          ],
        },
        {
          title: '2. Cancelling a Paid Plan',
          paragraphs: [
            'You may cancel or stop renewal of an eligible EveBash paid plan through your account settings where available, or by contacting support@evebash.com.',
            'Cancellation generally prevents the next renewal charge.',
            'Unless otherwise stated for a specific plan, cancellation does not automatically terminate the remaining paid subscription period.',
            'For example, if you purchase a monthly plan and cancel halfway through the billing month, you may continue using eligible paid features until the end of that paid billing period.',
            'After the paid period ends, your account may move to the applicable free plan, move to another plan selected, lose access to certain paid features, or become subject to lower storage/usage limits.',
          ],
        },
        {
          title: '3. Automatic Renewal',
          paragraphs: [
            'Where an EveBash subscription is configured to renew automatically, the subscription will continue for the applicable billing period until cancelled.',
            'Before purchasing an automatically renewing plan, EveBash will display the relevant billing frequency and renewal information.',
            'Where supported by the payment provider, renewal payments may be processed using the payment authorization established when the subscription was created.',
            'Users should cancel before the next scheduled renewal if they do not want the subscription to renew.',
          ],
        },
        {
          title: '4. Effect of Cancellation',
          paragraphs: [
            'Cancelling a subscription does not necessarily delete your EveBash account, events, galleries, photographs, videos, business profile, or other account information.',
            'Instead, cancellation normally affects the plan and features available after the active paid period ends.',
            'Account deletion is governed by EveBash\'s Privacy Policy and applicable data-retention rules.',
          ],
        },
        {
          title: '5. Plan Upgrades',
          paragraphs: [
            'Users may upgrade to a higher EveBash plan where available for additional storage, events, gallery capacity, business/media/AI features, or collaboration.',
            'Where technically supported, an upgrade may take effect immediately after successful payment confirmation.',
            'EveBash will not rely solely on a frontend payment-success message; the upgrade will be activated only after receiving reliable confirmation from the payment provider.',
          ],
        },
        {
          title: '6. Upgrade Pricing',
          paragraphs: [
            'The amount charged for an upgrade depends on the billing model (full price, prorated difference, account credit, replacement billing period, or next cycle scheduling).',
            'The applicable upgrade price and effective date will be displayed before confirmation.',
          ],
        },
        {
          title: '7. Plan Downgrades',
          paragraphs: [
            'A downgrade normally moves an account from a higher plan to a lower plan.',
            'Unless otherwise stated, EveBash intends to apply downgrades at the end of the current paid billing period rather than immediately, allowing users to continue using paid capacity during the active period.',
          ],
        },
        {
          title: '8. Storage After a Downgrade',
          paragraphs: [
            'If media stored exceeds the allowance of the downgraded plan, EveBash may temporarily restrict new uploads, notify the account holder, allow media removal/download, allow re-upgrading, or apply another reasonable process.',
            'EveBash does not intentionally delete valuable user media immediately merely because a downgrade takes effect without reasonable notice where practicable.',
          ],
        },
        {
          title: '9. Free Plan After Cancellation',
          paragraphs: [
            'If a paid subscription expires or is cancelled and the account becomes eligible for the free plan, the account becomes subject to free plan storage and feature limits.',
          ],
        },
        {
          title: '10. Refund Requests',
          paragraphs: [
            'Refund eligibility is determined according to law, purchase type, payment status, billing period, service activation, usage, duplicate charges, technical issues, and promotional terms.',
            'Submitting a request does not automatically guarantee approval; eligible requests are reviewed individually.',
          ],
        },
        {
          title: '11. Change-of-Mind Refunds',
          paragraphs: [
            'EveBash does not guarantee a full refund solely because a user changes their mind after a paid plan has been activated and substantially used (storage, processing, hosting, AI, downloads consumed).',
            'EveBash may provide a refund, credit, or resolution at its discretion where appropriate.',
          ],
        },
        {
          title: '12. Unused Subscription Period',
          paragraphs: [
            'Cancelling a subscription does not automatically entitle the user to a prorated refund for unused days unless expressly stated, approved, or required by law.',
          ],
        },
        {
          title: '13. Duplicate Payments',
          paragraphs: [
            'If you believe you were charged more than once for the same purchase, contact support@evebash.com with account email, transaction ID, date, and amount. Do not send sensitive credentials.',
          ],
        },
        {
          title: '14. Failed Payments',
          paragraphs: [
            'A failed payment normally does not activate the purchased plan. If money appears debited without plan activation, contact support with payment reference.',
          ],
        },
        {
          title: '15. Payment Successful but Plan Not Activated',
          paragraphs: [
            'If payment succeeds but the plan does not update, contact support@evebash.com. EveBash will verify webhooks/signatures and activate the plan, apply credit, or issue a refund.',
          ],
        },
        {
          title: '16. Payment Pending',
          paragraphs: [
            'Pending payments delay plan activation until transaction reaches a confirmed successful state.',
          ],
        },
        {
          title: '17. Refunds for Technical Problems',
          paragraphs: [
            'Remedies may be considered where a significant EveBash technical problem (activation failure, major functionality unavailable, system billing error) prevented service delivery.',
          ],
        },
        {
          title: '18. Partial Refunds and Credits',
          paragraphs: [
            'Where appropriate, EveBash may offer full/partial refunds, account credits, subscription extensions, or plan adjustments.',
          ],
        },
        {
          title: '19. Refund Method',
          paragraphs: [
            'Approved refunds will ordinarily be returned through the original payment method where technically possible.',
          ],
        },
        {
          title: '20. Refund Processing Time',
          paragraphs: [
            'After a refund is initiated, processing time depends on third-party gateways, banks, card networks, or UPI providers.',
          ],
        },
        {
          title: '21. Razorpay and Other Payment Providers',
          paragraphs: [
            'EveBash uses payment providers such as Razorpay. Gateway rules do not remove EveBash\'s obligation to address legitimate billing complaints.',
          ],
        },
        {
          title: '22. Chargebacks and Payment Disputes',
          paragraphs: [
            'If a payment is disputed or charged back, EveBash may temporarily restrict paid services while the dispute remains unresolved.',
          ],
        },
        {
          title: '23. Fraudulent or Abusive Refund Requests',
          paragraphs: [
            'EveBash may refuse refund requests involving fraud, intentional abuse, or repeated misuse of refund processes.',
          ],
        },
        {
          title: '24. Promotional and Discounted Plans',
          paragraphs: [
            'Promotional offers have specific eligibility, expiration, and refund conditions disclosed before purchase.',
          ],
        },
        {
          title: '25. Add-Ons and One-Time Purchases',
          paragraphs: [
            'Refund and cancellation treatment for one-time add-on purchases may differ from recurring subscriptions.',
          ],
        },
        {
          title: '26. Taxes and Fees',
          paragraphs: [
            'Approved refunds include or exclude applicable taxes depending on tax law, invoice treatment, and gateway rules.',
          ],
        },
        {
          title: '27. Account Termination by EveBash',
          paragraphs: [
            'Termination for serious violations or fraudulent activity does not automatically guarantee a refund.',
          ],
        },
        {
          title: '28. Discontinuation of an EveBash Service',
          paragraphs: [
            'If a service is permanently discontinued before subscription end, EveBash may provide migration, credit, extension, or refund remedies.',
          ],
        },
        {
          title: '29. How to Request a Refund',
          paragraphs: [
            'Email support@evebash.com with account email, order reference, purchase date, plan, amount, and issue explanation. Do not send passwords/PINs/CVVs.',
          ],
        },
        {
          title: '30. Review of Refund Requests',
          paragraphs: [
            'EveBash reviews requests using gateway logs, billing records, account activity, and storage/processing usage.',
          ],
        },
        {
          title: '31. Grievances',
          paragraphs: [
            'Billing grievances can be submitted to support@evebash.com under applicable consumer-protection principles.',
          ],
        },
        {
          title: '32. Changes to This Policy',
          paragraphs: [
            'EveBash may update this policy as subscription models, payment systems, or legal requirements change.',
          ],
        },
        {
          title: '33. Contact Us',
          paragraphs: [
            'For cancellation, billing, or refund questions, contact EveBash Support at support@evebash.com or via evebash.com.',
          ],
        },
      ]}
    />
  );
}
