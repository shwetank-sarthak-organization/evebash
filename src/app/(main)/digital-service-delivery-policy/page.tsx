import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function DigitalServiceDeliveryPolicyPage() {
  return (
    <LegalPolicyPage
      title="Digital Service Delivery Policy"
      lastUpdated="August 14, 2026"
      description="EveBash provides digital services and does not sell or ship physical products. Therefore, physical shipping, courier delivery, shipping charges, and delivery tracking do not apply to purchases made directly from EveBash."
      sections={[
        {
          title: "1. Digital Activation",
          content: (
            <p>
              After successful payment confirmation, eligible subscriptions, storage limits, features, or other digital services are activated electronically on the user's EveBash account.
            </p>
          ),
        },
        {
          title: "2. Activation Timelines",
          content: (
            <p>
              In most cases, activation occurs shortly after successful payment confirmation. In some circumstances, activation may be delayed because of payment verification, technical processing, security checks, payment-gateway delays, or temporary service issues.
            </p>
          ),
        },
        {
          title: "3. Activation Assistance",
          content: (
            <p>
              If payment has been successfully completed but the purchased plan or feature is not activated, users may contact <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a> with their payment or order reference for assistance.
            </p>
          ),
        },
        {
          title: "4. Address Requirements",
          content: (
            <p>
              EveBash does not require a physical delivery address for delivery of its digital services unless address information is separately required for billing, taxation, identity/business verification, or another lawful purpose.
            </p>
          ),
        },
        {
          title: "5. Cancellations and Refunds",
          content: (
            <p>
              Questions regarding cancellations or refunds are governed by the EveBash Cancellation & Refund Policy.
            </p>
          ),
        },
        {
          title: "6. Contact Us",
          content: (
            <p>
              For delivery or activation-related assistance, contact <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a>.
            </p>
          ),
        },
      ]}
    />
  );
}
