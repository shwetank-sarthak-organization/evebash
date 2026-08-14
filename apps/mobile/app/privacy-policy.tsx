import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function PrivacyPolicyScreen() {
  return (
    <LegalPolicyScreen
      title="Privacy Policy"
      lastUpdated="August 14, 2026"
      description="EveBash respects your privacy and is committed to handling personal information responsibly and transparently. This Privacy Policy explains how EveBash collects, uses, stores, processes, shares, and protects personal information when people use our websites, mobile applications, accounts, event galleries, media-sharing features, business features, subscriptions, payment features, find You functionality, and related services. By using EveBash, you acknowledge the practices described in this Privacy Policy. Where consent is required by applicable law, we will request appropriate consent before carrying out the relevant processing."
      sections={[
        {
          title: '1. Scope of This Privacy Policy',
          paragraphs: [
            'This Privacy Policy applies to personal information processed through EveBash, including information relating to: account holders; event organizers and hosts; gallery owners; guests; photographers and other media contributors; business users; visitors to our website; mobile application users; people contacting EveBash support; and other individuals whose personal information may be processed through the Services.',
            'Some photographs and videos uploaded by users may contain images of people who do not themselves have an EveBash account.',
            'The treatment of such information may depend on the circumstances, the person who uploaded the content, applicable privacy law, and the EveBash feature being used.',
          ],
        },
        {
          title: '2. Information We Collect',
          paragraphs: [
            'The information EveBash processes depends on how you use the Services. We may process the following categories of information.',
            'Account Information: name; email address; phone number, where provided or required; profile photograph; username or profile information; account type; authentication information; account preferences; language or regional settings; subscription status; and account creation and activity information.',
            'Passwords and authentication credentials are handled through the authentication systems used by EveBash and should not be stored by EveBash in readable plaintext form.',
            'Authentication Information: email and password authentication; email verification; password recovery; Google sign-in; Apple sign-in; and other supported authentication methods.',
            'Event Information: event name; event type; event description; event date; event location where provided; event organizer information; gallery settings; invitations; guest information; access permissions; event branding; comments and interactions; and other information supplied by the event organizer.',
            'Photos, Videos and Other Media: EveBash is a digital gallery and media platform. Users may upload photographs, videos, thumbnails, profile images, event artwork, business portfolio media, and other supported files.',
          ],
        },
        {
          title: '3. Media Processing',
          paragraphs: [
            'Depending on the features being used, uploaded photographs and videos may undergo technical processing including: storage; upload validation; format validation; image resizing; thumbnail generation; preview generation; compression; video transcoding; streaming preparation; video thumbnail extraction; metadata extraction; indexing; integrity checking; content moderation; access-control processing; caching; and delivery through content-delivery infrastructure.',
            'These processes are performed to operate, secure, optimize, and deliver EveBash galleries and related features.',
          ],
        },
        {
          title: '4. Find You and Facial Processing',
          paragraphs: [
            'EveBash may provide a feature called Find You or similar functionality that helps an authorized user locate photographs in an eligible gallery in which they may appear.',
            'When Find You is used, EveBash may process a photograph or image submitted by the user for facial matching.',
            'Technical processing includes: detecting a face; preparing or aligning facial regions; generating a mathematical facial representation/embedding; comparing with compatible representations; and returning potential matching photographs.',
            'A facial embedding is a mathematical representation used by the matching system. It is not intended to be used by EveBash to independently determine a person\'s legal identity.',
            'Find You results are probabilistic. The system may return incorrect matches, fail to return a match, or produce different results based on image quality/lighting.',
            '4.1 Purpose: Facial processing associated with Find You is intended to help authorized users locate their own or lawfully searchable photographs within eligible galleries.',
            '4.2 Consent & Availability: Where applicable law requires consent or another lawful basis, EveBash will implement appropriate notices, controls, or consent mechanisms.',
            '4.3 Retention: EveBash retains facial representations only for as long as reasonably necessary for the purpose created, subject to applicable requirements.',
          ],
        },
        {
          title: '5. Information About People Appearing in Event Media',
          paragraphs: [
            'Photographs and videos uploaded to EveBash may contain people who did not personally upload the content or create an EveBash account.',
            'Event organizers, photographers, businesses, and other users uploading media are responsible for ensuring they have the rights, permissions, consents, or other lawful basis required to upload and share that media.',
            'If you believe your personal information or image appears on EveBash without appropriate authorization, contact support@evebash.com.',
          ],
        },
        {
          title: '6. Gallery and Access Information',
          paragraphs: [
            'EveBash processes information relating to gallery configuration and access, including gallery/event identifiers, invitations, guest access, permissions, sharing settings, access links, and authentication status to ensure content is restricted to authorized users.',
          ],
        },
        {
          title: '7. Comments, Likes and Interactions',
          paragraphs: [
            'If EveBash provides interaction features, we process likes, reactions, comments, media/gallery interactions, and account identifiers.',
          ],
        },
        {
          title: '8. EB Business Information',
          paragraphs: [
            'Users creating profiles through EB Business provide business name, contact info, descriptions, categories, location, portfolio media, logo, links, and pricing. Information designated for public profiles is visible to visitors.',
          ],
        },
        {
          title: '9. EB Network Information',
          paragraphs: [
            'If you use EB Network, EveBash processes information necessary to enable professional discovery, networking, inquiries, recommendations, and listings.',
          ],
        },
        {
          title: '10. Payment and Subscription Information',
          paragraphs: [
            'Subscription purchases process plan selection, transaction ID, payment status, amount, currency, invoices, and renewal info.',
            'Payments are processed via third-party providers like Razorpay. EveBash does not store full payment-card numbers, UPI credentials, banking passwords, or CVVs.',
          ],
        },
        {
          title: '11. Technical and Usage Information',
          paragraphs: [
            'Technical information automatically processed includes IP address, browser type, operating system, device type, app version, request info, timestamps, error logs, security events, session info, and performance data.',
          ],
        },
        {
          title: '12. Cookies and Similar Technologies',
          paragraphs: [
            'EveBash uses cookies, local storage, session storage, and SDKs to maintain authentication, preserve sessions, remember preferences, secure accounts, and measure performance.',
          ],
        },
        {
          title: '13. How We Use Personal Information',
          paragraphs: [
            'Personal information is processed to create/maintain accounts, authenticate users, manage events/galleries, store/process media, deliver Find You, manage access, operate EB Business/Network, process payments, provide support, prevent fraud, and comply with law.',
          ],
        },
        {
          title: '14. How We Share Information',
          paragraphs: [
            'EveBash does not sell personal information.',
            'Service Providers: We rely on infrastructure providers for hosting, databases, auth, storage, CDN, media/AI processing, payments, email, analytics, and security.',
            'Other Users: Info is shared with other users when required by features (e.g. event hosts see participants, authorized guests see gallery media).',
            'Legal & Safety: We may preserve or disclose info to comply with law, enforce legal rights, investigate fraud, or protect safety.',
          ],
        },
        {
          title: '15. Our Technology Providers',
          paragraphs: [
            'Our architecture involves Vercel (web frontend), Railway (backend), Supabase (DB & auth), Backblaze B2 (storage), Cloudflare (CDN), Modal (AI & video processing), Upstash QStash (queues), Razorpay (payments), and Hostinger (email).',
          ],
        },
        {
          title: '16. International Processing and Data Transfers',
          paragraphs: [
            'Service providers may operate infrastructure internationally. Personal information may be processed or stored in other jurisdictions where permitted by law.',
          ],
        },
        {
          title: '17. Data Security',
          paragraphs: [
            'EveBash uses technical and organizational measures (authentication, access controls, encrypted connections, Row Level Security, rate limiting, monitoring) to protect personal information. No system can guarantee absolute security.',
          ],
        },
        {
          title: '18. Data Breaches and Security Incidents',
          paragraphs: [
            'If EveBash becomes aware of a data breach, we will investigate, contain, remediate, document, and provide required notifications under applicable law.',
          ],
        },
        {
          title: '19. Data Retention',
          paragraphs: [
            'Personal information is retained only as long as reasonably necessary for purposes processed, subject to legal, security, tax, and operational requirements.',
          ],
        },
        {
          title: '20. Account and Media Deletion',
          paragraphs: [
            'Users can delete individual media, galleries, events, or their account. Eligible data is removed according to retention procedures and legal requirements.',
          ],
        },
        {
          title: '21. Your Privacy Rights',
          paragraphs: [
            'Subject to law, you may request info, access, correction, updating, deletion, or withdrawal of consent regarding your personal information.',
          ],
        },
        {
          title: '22. Withdrawal of Consent',
          paragraphs: [
            'Where processing relies on consent, you may withdraw consent through provided mechanisms without affecting prior lawful processing.',
          ],
        },
        {
          title: '23. Children and Minors',
          paragraphs: [
            'Processing information involving children requires particular care. Uploaders are responsible for obtaining appropriate parental/guardian consents where required by law.',
          ],
        },
        {
          title: '24. Event Hosts and Privacy Responsibilities',
          paragraphs: [
            'Event hosts control upload, organization, and sharing settings for their events and must manage credentials and permissions responsibly.',
          ],
        },
        {
          title: '25. Changes to This Privacy Policy',
          paragraphs: [
            'EveBash may update this policy as services or legal requirements evolve. Changes will be reflected with an updated Last Updated date and appropriate notifications.',
          ],
        },
        {
          title: '26. Contact Us',
          paragraphs: [
            'For privacy questions, requests, or concerns, contact EveBash Support at support@evebash.com or via evebash.com.',
          ],
        },
        {
          title: '27. Grievance and Privacy Requests',
          paragraphs: [
            'Contact support@evebash.com for access, correction, deletion, consent, privacy complaints, unauthorized media concerns, or Find You requests.',
          ],
        },
      ]}
    />
  );
}
