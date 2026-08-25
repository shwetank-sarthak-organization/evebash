import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function PrivacyPolicyPage() {
  return (
    <LegalPolicyPage
      title="Privacy Policy"
      lastUpdated="August 14, 2026"
      description="EveBash respects your privacy and is committed to handling personal information responsibly and transparently. This Privacy Policy explains how EveBash collects, uses, stores, processes, shares, and protects personal information when people use our websites, mobile applications, accounts, event galleries, media-sharing features, business features, subscriptions, payment features, find You functionality, and related services. By using EveBash, you acknowledge the practices described in this Privacy Policy. Where consent is required by applicable law, we will request appropriate consent before carrying out the relevant processing."
      sections={[
        {
          title: "1. Scope of This Privacy Policy",
          content: (
            <>
              <p>
                This Privacy Policy applies to personal information processed through EveBash, including information relating to:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>account holders;</li>
                <li>event organizers and hosts;</li>
                <li>gallery owners;</li>
                <li>guests;</li>
                <li>photographers and other media contributors;</li>
                <li>business users;</li>
                <li>visitors to our website;</li>
                <li>mobile application users;</li>
                <li>people contacting EveBash support; and</li>
                <li>other individuals whose personal information may be processed through the Services.</li>
              </ul>
              <p>
                Some photographs and videos uploaded by users may contain images of people who do not themselves have an EveBash account.
              </p>
              <p>
                The treatment of such information may depend on the circumstances, the person who uploaded the content, applicable privacy law, and the EveBash feature being used.
              </p>
            </>
          ),
        },
        {
          title: "2. Information We Collect",
          content: (
            <>
              <p>
                The information EveBash processes depends on how you use the Services. We may process the following categories of information.
              </p>
              <h4 className="font-bold text-sky-400 mt-4">2.1 Account Information</h4>
              <p>When you create or maintain an EveBash account, we may process information such as:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>name;</li>
                <li>email address;</li>
                <li>phone number, where provided or required;</li>
                <li>profile photograph;</li>
                <li>username or profile information;</li>
                <li>account type;</li>
                <li>authentication information;</li>
                <li>account preferences;</li>
                <li>language or regional settings;</li>
                <li>subscription status; and</li>
                <li>account creation and activity information.</li>
              </ul>
              <p>
                Passwords and authentication credentials are handled through the authentication systems used by EveBash and should not be stored by EveBash in readable plaintext form.
              </p>

              <h4 className="font-bold text-sky-400 mt-4">2.2 Authentication Information</h4>
              <p>EveBash may use authentication providers and technologies to support:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>email and password authentication;</li>
                <li>email verification;</li>
                <li>password recovery;</li>
                <li>Google sign-in;</li>
                <li>Apple sign-in; and</li>
                <li>other supported authentication methods.</li>
              </ul>
              <p>
                When you use a third-party login provider, EveBash may receive information permitted by that provider, such as your name, email address, account identifier, or profile information.
              </p>

              <h4 className="font-bold text-sky-400 mt-4">2.3 Event Information</h4>
              <p>When an event is created or managed through EveBash, we may process information such as:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>event name;</li>
                <li>event type;</li>
                <li>event description;</li>
                <li>event date;</li>
                <li>event location where provided;</li>
                <li>event organizer information;</li>
                <li>gallery settings;</li>
                <li>invitations;</li>
                <li>guest information;</li>
                <li>access permissions;</li>
                <li>event branding;</li>
                <li>comments and interactions; and</li>
                <li>other information supplied by the event organizer.</li>
              </ul>

              <h4 className="font-bold text-sky-400 mt-4">2.4 Photos, Videos and Other Media</h4>
              <p>EveBash is a digital gallery and media platform. Users may upload:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>photographs;</li>
                <li>videos;</li>
                <li>thumbnails;</li>
                <li>profile images;</li>
                <li>event artwork;</li>
                <li>business portfolio media; and</li>
                <li>other files supported by the Services.</li>
              </ul>
              <p>
                Media may contain information about identifiable people. EveBash processes uploaded media to provide the Services requested by users and event organizers.
              </p>
            </>
          ),
        },
        {
          title: "3. Media Processing",
          content: (
            <>
              <p>
                Depending on the features being used, uploaded photographs and videos may undergo technical processing including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>storage;</li>
                <li>upload validation;</li>
                <li>format validation;</li>
                <li>image resizing;</li>
                <li>thumbnail generation;</li>
                <li>preview generation;</li>
                <li>compression;</li>
                <li>video transcoding;</li>
                <li>streaming preparation;</li>
                <li>video thumbnail extraction;</li>
                <li>metadata extraction;</li>
                <li>indexing;</li>
                <li>integrity checking;</li>
                <li>content moderation;</li>
                <li>access-control processing;</li>
                <li>caching; and</li>
                <li>delivery through content-delivery infrastructure.</li>
              </ul>
              <p>
                These processes are performed to operate, secure, optimize, and deliver EveBash galleries and related features.
              </p>
            </>
          ),
        },
        {
          title: "4. Find You and Facial Processing",
          content: (
            <>
              <p>
                EveBash may provide a feature called <strong>Find You</strong> or similar functionality that helps an authorized user locate photographs in an eligible gallery in which they may appear.
              </p>
              <p>
                When Find You is used, EveBash may process a photograph or image submitted by the user for facial matching.
              </p>
              <p>Technical processing may include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>detecting a face in an image;</li>
                <li>preparing or aligning the facial region;</li>
                <li>generating a mathematical facial representation or embedding;</li>
                <li>comparing that representation with compatible facial representations generated from eligible gallery photographs; and</li>
                <li>returning photographs that the system determines may contain a matching face.</li>
              </ul>
              <p>
                A facial embedding is a mathematical representation used by the matching system. It is not intended to be used by EveBash to independently determine a person's legal identity.
              </p>
              <p>Find You results are probabilistic. The system may:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>return incorrect matches;</li>
                <li>fail to return a correct match; or</li>
                <li>produce different results depending on image quality, lighting, angle, obstruction, and other technical factors.</li>
              </ul>
              <p>Find You should therefore not be treated as definitive proof of identity.</p>

              <h4 className="font-bold text-sky-400 mt-4">4.1 Purpose of Find You Processing</h4>
              <p>
                Facial processing associated with Find You is intended to help authorized users locate their own or otherwise lawfully searchable photographs within eligible EveBash event galleries.
              </p>
              <p>
                EveBash does not intend Find You to be used for general public facial identification, surveillance, stalking, law-enforcement identification, or unrelated profiling.
              </p>

              <h4 className="font-bold text-sky-400 mt-4">4.2 Consent and Availability</h4>
              <p>
                Where applicable law requires consent or another lawful basis for facial processing, EveBash will implement appropriate notices, controls, or consent mechanisms.
              </p>
              <p>
                Find You may therefore be unavailable or subject to additional requirements depending on jurisdiction, age, gallery settings, event-host settings, applicable law, or other privacy considerations.
              </p>

              <h4 className="font-bold text-sky-400 mt-4">4.3 Facial Data Retention</h4>
              <p>
                EveBash should retain facial representations only for as long as reasonably necessary for the purpose for which they were created, subject to applicable legal, security, dispute-resolution, and technical requirements.
              </p>
              <p>
                The precise production retention schedule for Find You data should be documented and reflected in EveBash's technical systems.
              </p>
              <p>
                Where deletion is required or requested and applicable, EveBash will delete or de-identify eligible facial-processing data according to its applicable retention procedures.
              </p>
            </>
          ),
        },
        {
          title: "5. Information About People Appearing in Event Media",
          content: (
            <>
              <p>
                Photographs and videos uploaded to EveBash may contain people who did not personally upload the content or create an EveBash account.
              </p>
              <p>
                Event organizers, photographers, businesses, and other users uploading media are responsible for ensuring they have the rights, permissions, consents, or other lawful basis required to upload and share that media.
              </p>
              <p>
                If you believe your personal information or image appears on EveBash without appropriate authorization, you may contact: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a>.
              </p>
              <p>
                EveBash may investigate appropriate privacy, safety, or legal requests and may restrict or remove content where required or appropriate.
              </p>
            </>
          ),
        },
        {
          title: "6. Gallery and Access Information",
          content: (
            <>
              <p>
                EveBash may process information relating to how galleries are configured and accessed. This may include:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>gallery identifiers;</li>
                <li>event identifiers;</li>
                <li>invitations;</li>
                <li>guest access;</li>
                <li>access permissions;</li>
                <li>sharing settings;</li>
                <li>private/public settings;</li>
                <li>access links;</li>
                <li>authentication status; and</li>
                <li>activity necessary to maintain gallery security.</li>
              </ul>
              <p>
                This information helps EveBash ensure that restricted content is available only to users who are authorized to access it.
              </p>
            </>
          ),
        },
        {
          title: "7. Comments, Likes and Interactions",
          content: (
            <>
              <p>
                If EveBash provides social or interaction features, we may process information such as likes, reactions, comments, media interactions, gallery interactions, and related account identifiers.
              </p>
              <p>
                Some interactions may be visible to event organizers or other authorized gallery participants depending on the feature and privacy settings.
              </p>
            </>
          ),
        },
        {
          title: "8. EB Business Information",
          content: (
            <>
              <p>
                Users creating profiles through <strong>EB Business</strong> or related business features may provide information including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>business name;</li>
                <li>contact information;</li>
                <li>business description;</li>
                <li>service categories;</li>
                <li>location;</li>
                <li>portfolio photographs or videos;</li>
                <li>business logo;</li>
                <li>website or social links;</li>
                <li>pricing or service information; and</li>
                <li>other information intentionally published as part of the business profile.</li>
              </ul>
              <p>
                Information designated for a public business profile may be visible to other EveBash users or visitors. Users should avoid publishing information they do not want to make publicly available.
              </p>
            </>
          ),
        },
        {
          title: "9. EB Network Information",
          content: (
            <>
              <p>
                If you use <strong>EB Network</strong>, EveBash may process information necessary to enable professional discovery, networking, inquiries, recommendations, listings, or related functionality.
              </p>
              <p>
                Information intentionally published through a public or discoverable profile may be visible to other users according to your applicable settings.
              </p>
            </>
          ),
        },
        {
          title: "10. Payment and Subscription Information",
          content: (
            <>
              <p>
                When you purchase an EveBash subscription or paid service, we may process information including:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>selected plan;</li>
                <li>transaction identifier;</li>
                <li>payment status;</li>
                <li>amount;</li>
                <li>currency;</li>
                <li>invoice information;</li>
                <li>subscription status;</li>
                <li>renewal information;</li>
                <li>payment timestamps; and</li>
                <li>refund or dispute status.</li>
              </ul>
              <p>
                Payments may be processed through third-party payment providers such as Razorpay.
              </p>
              <p>
                EveBash does <strong>not intend to store full payment-card numbers, UPI credentials, banking passwords, CVVs, or similar sensitive payment credentials</strong> when those credentials are collected and processed directly by the payment provider.
              </p>
              <p>
                Payment providers process payment information according to their own terms and privacy practices.
              </p>
            </>
          ),
        },
        {
          title: "11. Technical and Usage Information",
          content: (
            <>
              <p>
                When you use EveBash, certain technical information may be processed automatically. This may include:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>IP address;</li>
                <li>browser type;</li>
                <li>operating system;</li>
                <li>device type;</li>
                <li>application version;</li>
                <li>request information;</li>
                <li>timestamps;</li>
                <li>error logs;</li>
                <li>security events;</li>
                <li>session information;</li>
                <li>network information;</li>
                <li>pages or features accessed;</li>
                <li>performance information; and</li>
                <li>diagnostic information.</li>
              </ul>
              <p>
                This information helps us operate, secure, troubleshoot, monitor, and improve the Services.
              </p>
            </>
          ),
        },
        {
          title: "12. Cookies and Similar Technologies",
          content: (
            <>
              <p>
                EveBash may use cookies, local storage, session storage, SDKs, or similar technologies where necessary to:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>maintain authentication;</li>
                <li>preserve sessions;</li>
                <li>remember preferences;</li>
                <li>secure accounts;</li>
                <li>prevent abuse;</li>
                <li>measure performance;</li>
                <li>understand product usage; and</li>
                <li>improve the Services.</li>
              </ul>
              <p>
                Where required by applicable law, EveBash will provide appropriate controls or obtain consent before using non-essential cookies or similar technologies. Additional details may be provided through a separate Cookie Policy.
              </p>
            </>
          ),
        },
        {
          title: "13. How We Use Personal Information",
          content: (
            <>
              <p>EveBash may process personal information to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>create and maintain accounts;</li>
                <li>authenticate users;</li>
                <li>manage events;</li>
                <li>create and display galleries;</li>
                <li>store photographs and videos;</li>
                <li>process media;</li>
                <li>deliver media to authorized users;</li>
                <li>provide Find You where enabled;</li>
                <li>manage invitations and gallery access;</li>
                <li>enable comments, likes, and interactions;</li>
                <li>operate EB Business and EB Network;</li>
                <li>process subscriptions;</li>
                <li>confirm payments;</li>
                <li>communicate service information;</li>
                <li>provide customer support;</li>
                <li>detect prohibited content;</li>
                <li>prevent fraud and abuse;</li>
                <li>protect accounts and infrastructure;</li>
                <li>investigate security incidents;</li>
                <li>enforce our Terms and policies;</li>
                <li>troubleshoot technical issues;</li>
                <li>maintain service reliability;</li>
                <li>understand and improve the Services; and</li>
                <li>comply with applicable legal obligations.</li>
              </ul>
              <p>
                We seek to process personal information only for purposes connected with operating EveBash or for other purposes communicated to users as required by applicable law.
              </p>
            </>
          ),
        },
        {
          title: "14. How We Share Information",
          content: (
            <>
              <p>
                EveBash does <strong>not sell personal information</strong>. We may share or make information available in limited circumstances described below.
              </p>
              <h4 className="font-bold text-sky-400 mt-4">Service Providers</h4>
              <p>
                EveBash relies on infrastructure and technology providers to operate the platform. Depending on the deployed architecture, these may include providers supporting:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>website hosting;</li>
                <li>backend hosting;</li>
                <li>database services;</li>
                <li>authentication;</li>
                <li>object storage;</li>
                <li>content delivery;</li>
                <li>media processing;</li>
                <li>artificial-intelligence processing;</li>
                <li>background jobs;</li>
                <li>payments;</li>
                <li>email;</li>
                <li>analytics;</li>
                <li>monitoring; and</li>
                <li>security.</li>
              </ul>
              <p>
                These providers may process limited information as necessary to perform services for EveBash.
              </p>

              <h4 className="font-bold text-sky-400 mt-4">Other EveBash Users</h4>
              <p>
                Information may be shared with other users when required by the feature being used. For example:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>event hosts may see event participants;</li>
                <li>authorized guests may see gallery media;</li>
                <li>comments may be visible to gallery participants;</li>
                <li>business information may be publicly discoverable;</li>
                <li>gallery owners may see relevant activity; and</li>
                <li>Find You may return eligible photographs to an authorized user.</li>
              </ul>
              <p>
                Visibility depends on the feature, event settings, account permissions, and applicable privacy controls.
              </p>

              <h4 className="font-bold text-sky-400 mt-4">Legal and Safety Requirements</h4>
              <p>
                EveBash may preserve, disclose, or provide information where reasonably necessary to:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>comply with applicable law;</li>
                <li>respond to legally valid requests;</li>
                <li>enforce legal rights;</li>
                <li>investigate fraud;</li>
                <li>address security incidents;</li>
                <li>protect users;</li>
                <li>prevent serious harm; or</li>
                <li>enforce EveBash policies.</li>
              </ul>
              <p>
                Where legally permitted and appropriate, EveBash will seek to protect user privacy when responding to such requests.
              </p>
            </>
          ),
        },
        {
          title: "15. Our Technology Providers",
          content: (
            <>
              <p>
                EveBash's infrastructure may use third-party providers for different technical purposes. Our current or intended architecture may involve services such as:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Vercel for web frontend hosting;</li>
                <li>Railway for backend services;</li>
                <li>Supabase for database and authentication;</li>
                <li>Backblaze B2 for media storage;</li>
                <li>Cloudflare for media delivery and caching;</li>
                <li>Modal for specialized AI and video processing;</li>
                <li>Upstash QStash for background-job delivery;</li>
                <li>Razorpay for payment processing; and</li>
                <li>Hostinger for business email services.</li>
              </ul>
              <p>
                The specific provider configuration may change as EveBash's infrastructure evolves. We may replace providers where appropriate without materially changing the purposes for which personal information is processed.
              </p>
            </>
          ),
        },
        {
          title: "16. International Processing and Data Transfers",
          content: (
            <>
              <p>
                Some EveBash service providers may operate infrastructure in countries outside the location where a user resides. As a result, personal information may be processed or stored in other jurisdictions where permitted by applicable law.
              </p>
              <p>
                Where cross-border processing is subject to legal requirements or restrictions, EveBash will take steps reasonably required to comply with those requirements.
              </p>
            </>
          ),
        },
        {
          title: "17. Data Security",
          content: (
            <>
              <p>
                EveBash uses technical and organizational measures intended to protect personal information against unauthorized access, alteration, disclosure, loss, misuse, or destruction.
              </p>
              <p>Depending on the system involved, measures may include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>authentication;</li>
                <li>access controls;</li>
                <li>private storage;</li>
                <li>encrypted network connections;</li>
                <li>secure API communication;</li>
                <li>restricted server credentials;</li>
                <li>database security controls;</li>
                <li>Row Level Security;</li>
                <li>temporary media-access mechanisms;</li>
                <li>logging;</li>
                <li>monitoring;</li>
                <li>rate limiting;</li>
                <li>security updates; and</li>
                <li>separation of development, staging, and production systems.</li>
              </ul>
              <p>
                However, no online system can guarantee absolute security. Users are also responsible for protecting their account credentials and gallery-access information.
              </p>
            </>
          ),
        },
        {
          title: "18. Data Breaches and Security Incidents",
          content: (
            <>
              <p>
                If EveBash becomes aware of a personal-data breach or security incident, we may investigate, contain, remediate, document, and provide notifications where required under applicable law.
              </p>
              <p>
                Users should promptly contact EveBash if they believe their account or information has been compromised.
              </p>
            </>
          ),
        },
        {
          title: "19. Data Retention",
          content: (
            <>
              <p>
                EveBash retains personal information only for as long as reasonably necessary for the purposes for which it is processed, subject to legal, security, contractual, accounting, fraud-prevention, dispute-resolution, and operational requirements.
              </p>
              <p>Retention periods may vary according to the type of information. For example:</p>
              <p className="mt-2 font-bold text-sky-400">Account information</p>
              <p>May be retained while the account remains active and for an appropriate period after deletion where necessary.</p>

              <p className="mt-2 font-bold text-sky-400">Uploaded media</p>
              <p>May be retained while associated events, galleries, subscriptions, or accounts remain active and according to applicable storage and deletion policies.</p>

              <p className="mt-2 font-bold text-sky-400">Payment records</p>
              <p>May be retained for accounting, taxation, fraud prevention, disputes, and other legal obligations.</p>

              <p className="mt-2 font-bold text-sky-400">Security logs</p>
              <p>May be retained for a reasonable period for security monitoring and investigation.</p>

              <p className="mt-2 font-bold text-sky-400">Facial representations</p>
              <p>Should be retained only for the period reasonably necessary to provide the relevant Find You functionality and satisfy applicable legal or security requirements.</p>

              <p className="mt-2 font-bold text-sky-400">Backups and caches</p>
              <p>Deleted information may remain temporarily in backups, caches, logs, or technical systems until those copies are overwritten or removed according to normal retention cycles.</p>
            </>
          ),
        },
        {
          title: "20. Account and Media Deletion",
          content: (
            <>
              <p>
                Users may be able to delete individual media, galleries, events, business information, or their EveBash account depending on their permissions and the applicable feature.
              </p>
              <p>
                Deletion from the user interface may not result in immediate removal from every backup, cache, log, or processing system. EveBash will remove or de-identify eligible information according to applicable retention procedures and legal requirements.
              </p>
            </>
          ),
        },
        {
          title: "21. Your Privacy Rights",
          content: (
            <>
              <p>
                Depending on applicable law and the circumstances of processing, you may have rights relating to your personal information. These may include the ability to:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>request information about personal data being processed;</li>
                <li>request access to eligible personal information;</li>
                <li>request correction of inaccurate information;</li>
                <li>request completion or updating of information;</li>
                <li>request deletion or erasure where applicable;</li>
                <li>withdraw consent where processing is based on consent;</li>
                <li>manage certain privacy choices;</li>
                <li>raise a grievance or complaint; and</li>
                <li>exercise other rights available under applicable data-protection law.</li>
              </ul>
              <p>
                Requests may be subject to identity verification and applicable legal limitations. India's Digital Personal Data Protection framework provides rights relating to access, correction, erasure and grievance redressal, among other matters, as applicable when the relevant provisions are in force.
              </p>
            </>
          ),
        },
        {
          title: "22. Withdrawal of Consent",
          content: (
            <>
              <p>
                Where EveBash relies on consent for a particular processing activity, you may withdraw that consent through the method provided by EveBash.
              </p>
              <p>
                Withdrawal of consent does not necessarily affect processing that lawfully occurred before withdrawal. Withdrawing consent may make certain features unavailable where the relevant information is necessary to provide those features.
              </p>
              <p>
                Where required by applicable law, withdrawing consent should be reasonably accessible and comparable in ease to giving consent. India's notified DPDP framework specifically addresses mechanisms for withdrawal and exercising data rights.
              </p>
            </>
          ),
        },
        {
          title: "23. Children and Minors",
          content: (
            <>
              <p>EveBash events and galleries may contain photographs or videos of children.</p>
              <p>Processing information relating to children requires particular care.</p>
              <p>
                Event organizers and uploaders are responsible for ensuring they have appropriate authority or permission to upload and share content involving children.
              </p>
              <p>
                Where applicable law requires parental or guardian consent for processing a child's personal information or use of particular features, EveBash will require appropriate consent or restrict the relevant feature.
              </p>
              <p>
                Find You or other facial-processing functionality involving children may be subject to additional restrictions or may be unavailable depending on applicable legal requirements and EveBash policy.
              </p>
            </>
          ),
        },
        {
          title: "24. Event Hosts and Privacy Responsibilities",
          content: (
            <>
              <p>
                Event hosts and gallery owners control certain aspects of how content is uploaded, organized, and shared through their events.
              </p>
              <p>Hosts should:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>invite only appropriate participants;</li>
                <li>manage gallery access responsibly;</li>
                <li>avoid publicly exposing private gallery credentials;</li>
                <li>ensure they have appropriate rights to uploaded media;</li>
                <li>respect requests concerning personal content where applicable; and</li>
                <li>configure gallery privacy settings appropriately.</li>
              </ul>
              <p>
                EveBash provides the platform infrastructure, while event organizers remain responsible for their own use of the Services and the content they choose to upload or share.
              </p>
            </>
          ),
        },
        {
          title: "25. Changes to This Privacy Policy",
          content: (
            <>
              <p>
                EveBash may update this Privacy Policy as the Services, technology, or legal requirements change.
              </p>
              <p>When we update the policy, we will change the <strong>Last updated</strong> date.</p>
              <p>For material changes, we may provide additional notice through:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>the EveBash website;</li>
                <li>the application;</li>
                <li>email;</li>
                <li>the user dashboard; or</li>
                <li>another appropriate communication method.</li>
              </ul>
              <p>Where applicable law requires renewed consent, we will request it.</p>
            </>
          ),
        },
        {
          title: "26. Contact Us",
          content: (
            <>
              <p>
                For privacy questions, requests, complaints, account issues, or concerns about photographs or videos appearing on EveBash, contact:
              </p>
              <div className="mt-2 space-y-1 rounded-xl bg-[var(--site-card-muted)] p-4 text-sm">
                <p><strong>EveBash</strong></p>
                <p><strong>Email:</strong> <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a></p>
                <p><strong>Website:</strong> evebash.com</p>
              </div>
              <p className="mt-3 text-xs text-[var(--site-muted)]">
                Before public launch, EveBash should add its final legal entity name, registered/business address, and the appropriate privacy/grievance contact details required under applicable law.
              </p>
            </>
          ),
        },
        {
          title: "27. Grievance and Privacy Requests",
          content: (
            <>
              <p>Users may contact EveBash at: <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a> for matters including:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>access requests;</li>
                <li>correction requests;</li>
                <li>deletion requests;</li>
                <li>consent-related requests;</li>
                <li>privacy complaints;</li>
                <li>unauthorized media concerns;</li>
                <li>Find You concerns; and</li>
                <li>other privacy questions.</li>
              </ul>
              <p>
                EveBash may request reasonable information to verify the identity or authority of the person submitting a request before acting on it.
              </p>
              <p>
                Additional grievance-redressal information will be provided where required by applicable law.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
