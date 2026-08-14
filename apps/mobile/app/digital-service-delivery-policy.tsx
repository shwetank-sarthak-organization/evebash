import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function DigitalServiceDeliveryPolicyScreen() {
  return (
    <LegalPolicyScreen
      title="Digital Service Delivery Policy"
      lastUpdated="August 14, 2026"
      description="EveBash provides digital services and does not sell or ship physical products. Therefore, physical shipping, courier delivery, shipping charges, and delivery tracking do not apply to purchases made directly from EveBash."
      sections={[
        {
          title: '1. Digital Activation',
          paragraphs: [
            'After successful payment confirmation, eligible subscriptions, storage limits, features, or other digital services are activated electronically on the user\'s EveBash account.',
          ],
        },
        {
          title: '2. Activation Timelines',
          paragraphs: [
            'In most cases, activation occurs shortly after successful payment confirmation. In some circumstances, activation may be delayed because of payment verification, technical processing, security checks, payment-gateway delays, or temporary service issues.',
          ],
        },
        {
          title: '3. Activation Assistance',
          paragraphs: [
            'If payment has been successfully completed but the purchased plan or feature is not activated, users may contact support@evebash.com with their payment or order reference for assistance.',
          ],
        },
        {
          title: '4. Address Requirements',
          paragraphs: [
            'EveBash does not require a physical delivery address for delivery of its digital services unless address information is separately required for billing, taxation, identity/business verification, or another lawful purpose.',
          ],
        },
        {
          title: '5. Cancellations and Refunds',
          paragraphs: [
            'Questions regarding cancellations or refunds are governed by the EveBash Cancellation & Refund Policy.',
          ],
        },
        {
          title: '6. Contact Us',
          paragraphs: [
            'For delivery or activation-related assistance, contact support@evebash.com.',
          ],
        },
      ]}
    />
  );
}
