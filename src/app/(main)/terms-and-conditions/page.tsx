import LegalPolicyPage from "@/components/LegalPolicyPage";

export default function TermsAndConditionsPage() {
  return (
    <LegalPolicyPage
      title="Terms & Conditions"
      lastUpdated="August 14, 2026"
      description="These Terms & Conditions govern your access to and use of EveBash websites, applications, accounts, galleries, event-management features, media-upload and sharing services, business features, subscriptions, find You features, and other services provided through EveBash. By creating an account, accessing EveBash, purchasing a plan, uploading content, creating or joining an event or gallery, or otherwise using the Services, you agree to these Terms & Conditions. If you do not agree to these Terms, you should not use the Services."
      sections={[
        {
          title: "1. About EveBash",
          content: (
            <>
              <p>
                EveBash is a digital event and media platform that enables users to create and manage events and galleries, upload and organize photographs and videos, share event media with authorized users or guests, discover event-related businesses and services where available, and use additional features offered by EveBash.
              </p>
              <p>
                Certain features may vary according to the user's plan, location, device, account type, or availability.
              </p>
              <p>
                EveBash may introduce, modify, replace, or discontinue features in accordance with these Terms.
              </p>
            </>
          ),
        },
        {
          title: "2. Eligibility",
          content: (
            <>
              <p>
                You may use EveBash only if you are legally capable of entering into a binding agreement under applicable law.
              </p>
              <p>
                If you use EveBash on behalf of a company, organization, event organizer, photography business, or another legal entity, you represent that you have authority to accept these Terms on its behalf.
              </p>
              <p>
                Where additional consent is required for minors or other persons under applicable law, the account holder, organizer, uploader, or responsible adult must obtain the required consent before using EveBash in relation to those persons.
              </p>
            </>
          ),
        },
        {
          title: "3. User Accounts",
          content: (
            <>
              <p>Certain EveBash Services require an account.</p>
              <p>You agree to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>provide accurate and reasonably current account information;</li>
                <li>keep your login credentials secure;</li>
                <li>not knowingly allow unauthorized persons to use your account;</li>
                <li>promptly notify EveBash if you believe your account has been compromised; and</li>
                <li>take reasonable responsibility for activities performed through your account.</li>
              </ul>
              <p>
                You must not impersonate another person or organization or create an account using information you are not authorized to use.
              </p>
              <p>
                EveBash may require email verification, identity verification, additional authentication, or other reasonable security measures.
              </p>
            </>
          ),
        },
        {
          title: "4. Event Hosts and Organizers",
          content: (
            <>
              <p>
                Users may be able to create events, galleries, invitations, access links, guest experiences, or other event-related resources.
              </p>
              <p>
                An event host or organizer is responsible for managing access to their event and determining who may access private galleries or other restricted content.
              </p>
              <p>Event hosts must use reasonable care when sharing:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>gallery links;</li>
                <li>invitations;</li>
                <li>QR codes;</li>
                <li>access codes;</li>
                <li>passwords;</li>
                <li>guest credentials; or</li>
                <li>other private access mechanisms.</li>
              </ul>
              <p>
                EveBash is not responsible for unauthorized access resulting from an organizer or authorized user voluntarily sharing private access information with another person, except to the extent responsibility cannot legally be excluded.
              </p>
            </>
          ),
        },
        {
          title: "5. Guests and Gallery Access",
          content: (
            <>
              <p>
                Guests may receive access to event galleries or other content through invitations, links, QR codes, credentials, or other mechanisms.
              </p>
              <p>
                Access to a gallery does not transfer ownership of its photographs, videos, or other content.
              </p>
              <p>
                Guests must respect any restrictions imposed by the event organizer, content owner, photographer, or applicable law.
              </p>
              <p>
                Users must not attempt to bypass access controls or obtain access to galleries, events, accounts, media, or information they are not authorized to access.
              </p>
            </>
          ),
        },
        {
          title: "6. User Content",
          content: (
            <>
              <p>
                &quot;User Content&quot; includes photographs, videos, profile information, comments, captions, business information, event information, logos, text, files, and other material submitted, uploaded, created, or shared through EveBash.
              </p>
              <h4 className="font-bold text-sky-400">You retain ownership</h4>
              <p>
                EveBash does <strong>not</strong> claim ownership of your User Content.
              </p>
              <p>
                Subject to the rights of photographers, creators, event organizers, guests, or other applicable rights holders, you retain the rights you have in the content you upload.
              </p>
            </>
          ),
        },
        {
          title: "7. Permission Granted to EveBash",
          content: (
            <>
              <p>
                To operate the Services, you grant EveBash a limited, non-exclusive license to process User Content solely as reasonably necessary to provide, secure, maintain, improve, and operate the Services.
              </p>
              <p>This may include the technical right to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>upload and store content;</li>
                <li>copy content for technical processing;</li>
                <li>display content to authorized users;</li>
                <li>deliver content through networks and content-delivery systems;</li>
                <li>resize photographs;</li>
                <li>compress media;</li>
                <li>create thumbnails and previews;</li>
                <li>transcode videos;</li>
                <li>generate streaming formats;</li>
                <li>extract technical metadata;</li>
                <li>perform security and moderation checks;</li>
                <li>perform authorized search, indexing, and matching operations;</li>
                <li>create technical backups or temporary processing copies; and</li>
                <li>otherwise process content as necessary to provide features requested or enabled by users.</li>
              </ul>
              <p>
                This license does not give EveBash ownership of your User Content.
              </p>
              <p>
                EveBash will not acquire the right to sell your photographs or videos merely because you uploaded them to the Services.
              </p>
              <p>
                The license exists for purposes connected with operating and providing EveBash and ends when the relevant content is deleted, subject to reasonable technical retention, backups, legal requirements, fraud prevention, dispute resolution, and other legitimate retention requirements described in EveBash policies.
              </p>
            </>
          ),
        },
        {
          title: "8. Your Responsibility for Uploaded Content",
          content: (
            <>
              <p>
                You are responsible for User Content you upload or make available through EveBash.
              </p>
              <p>
                By uploading content, you represent that you have the rights, permissions, licenses, or other lawful basis necessary to upload, process, store, display, and share that content through the Services.
              </p>
              <p>For example, depending on the circumstances, these rights may belong to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>you;</li>
                <li>a photographer;</li>
                <li>an event organizer;</li>
                <li>a client;</li>
                <li>an employer;</li>
                <li>another copyright owner; or</li>
                <li>persons appearing in the media.</li>
              </ul>
              <p>
                You must not knowingly upload content in a manner that infringes another person's intellectual-property, privacy, publicity, confidentiality, or other legal rights.
              </p>
            </>
          ),
        },
        {
          title: "9. Prohibited Content",
          content: (
            <>
              <p>
                EveBash must not be used to upload, store, distribute, promote, or facilitate content that is unlawful or prohibited under these Terms.
              </p>
              <p>Prohibited content may include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>child sexual abuse or exploitation material;</li>
                <li>sexual exploitation of minors;</li>
                <li>non-consensual intimate imagery;</li>
                <li>unlawful sexually explicit material;</li>
                <li>content promoting or facilitating serious illegal activity;</li>
                <li>content unlawfully threatening or harassing another person;</li>
                <li>material that unlawfully violates another person's privacy;</li>
                <li>content that infringes copyrights, trademarks, or other intellectual-property rights;</li>
                <li>malicious software or files intended to damage systems;</li>
                <li>fraudulent or deceptive content intended to cause unlawful harm;</li>
                <li>content prohibited by applicable law; and</li>
                <li>other content EveBash reasonably determines presents a serious legal, security, or safety risk.</li>
              </ul>
              <p>
                EveBash may establish additional content standards through a separate Content Policy.
              </p>
            </>
          ),
        },
        {
          title: "10. Content Moderation",
          content: (
            <>
              <p>EveBash may use a combination of:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>automated systems;</li>
                <li>technical detection systems;</li>
                <li>user reports;</li>
                <li>administrator review; and</li>
                <li>manual review</li>
              </ul>
              <p>
                to identify content or conduct that may violate these Terms or applicable law.
              </p>
              <p>
                Where reasonably appropriate, content may be classified as safe, restricted, requiring review, or prohibited.
              </p>
              <p>EveBash may:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>restrict publication;</li>
                <li>temporarily quarantine content;</li>
                <li>limit access;</li>
                <li>remove content;</li>
                <li>disable sharing;</li>
                <li>request additional information;</li>
                <li>suspend relevant features;</li>
                <li>suspend an account; or</li>
                <li>terminate an account</li>
              </ul>
              <p>
                where reasonably necessary to enforce these Terms, protect users, maintain platform security, or comply with applicable law.
              </p>
              <p>
                Automated systems may make mistakes. Where EveBash provides an appeal or review process, users may use that process to request reconsideration.
              </p>
            </>
          ),
        },
        {
          title: "11. Find You and Facial Matching",
          content: (
            <>
              <p>
                EveBash may provide a feature referred to as <strong>Find You</strong> or a similar feature that helps an authorized user locate photographs in which they may appear.
              </p>
              <p>
                Where enabled, the feature may process a submitted photograph or facial image and create a mathematical representation or embedding used to compare the submitted face with faces detected in eligible gallery photographs.
              </p>
              <p>
                The feature is intended to help users locate relevant media within authorized EveBash galleries.
              </p>
              <p>
                Use of Find You is subject to EveBash's Privacy Policy and any additional notices or consent requirements presented when the feature is used.
              </p>
              <p>Users must not use Find You to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>identify or track people for unlawful purposes;</li>
                <li>stalk or harass another person;</li>
                <li>circumvent gallery-access restrictions;</li>
                <li>conduct unauthorized surveillance; or</li>
                <li>otherwise violate applicable law or another person's rights.</li>
              </ul>
              <p>
                Availability of Find You may depend on the event, gallery, jurisdiction, account settings, consent requirements, and technical availability.
              </p>
              <p>
                Facial matching is probabilistic and may produce incorrect matches or fail to identify relevant photographs.
              </p>
              <p>
                Users should therefore not treat Find You results as definitive proof of a person's identity or presence.
              </p>
            </>
          ),
        },
        {
          title: "12. Media Processing",
          content: (
            <>
              <p>
                To provide digital-gallery functionality, EveBash may technically process uploaded images and videos.
              </p>
              <p>Processing may include:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>image resizing;</li>
                <li>thumbnail generation;</li>
                <li>preview generation;</li>
                <li>compression;</li>
                <li>format conversion;</li>
                <li>video transcoding;</li>
                <li>video thumbnail extraction;</li>
                <li>streaming preparation;</li>
                <li>metadata extraction;</li>
                <li>duplicate or integrity checks;</li>
                <li>content moderation; and</li>
                <li>authorized facial processing where applicable.</li>
              </ul>
              <p>
                Processing may be performed using EveBash infrastructure or third-party infrastructure providers acting in connection with the Services.
              </p>
            </>
          ),
        },
        {
          title: "13. Storage",
          content: (
            <>
              <p>EveBash plans may provide different storage allowances.</p>
              <p>Storage limits may apply to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>photographs;</li>
                <li>videos;</li>
                <li>thumbnails;</li>
                <li>previews;</li>
                <li>derived media;</li>
                <li>event content; and</li>
                <li>other files associated with an account.</li>
              </ul>
              <p>
                The applicable storage allowance will be shown with the relevant plan or account.
              </p>
              <p>Users must not deliberately circumvent storage limitations.</p>
              <p>
                If an account exceeds its permitted storage, EveBash may restrict additional uploads, request an upgrade, provide an opportunity to remove content, or take other reasonable action consistent with the applicable plan.
              </p>
            </>
          ),
        },
        {
          title: "14. Backups and Original Media",
          content: (
            <>
              <p>
                EveBash uses infrastructure and operational measures intended to provide reliable media storage and delivery.
              </p>
              <p>
                However, no online storage system can guarantee permanent or uninterrupted preservation of every file.
              </p>
              <p>
                Unless EveBash expressly offers a separate guaranteed archival service, users should maintain their own copies of important original photographs, videos, and other irreplaceable media.
              </p>
              <p>EveBash should not be treated as the sole archival copy of irreplaceable media.</p>
              <p>Nothing in this section excludes liability that cannot lawfully be excluded.</p>
            </>
          ),
        },
        {
          title: "15. Business Features and EB Business",
          content: (
            <>
              <p>
                EveBash may allow businesses, photographers, event professionals, vendors, or service providers to create profiles or listings through features such as <strong>EB Business</strong>.
              </p>
              <p>
                Businesses are responsible for the accuracy of information they publish, including descriptions, contact information, availability, pricing, services, portfolios, and other representations.
              </p>
              <p>
                Unless expressly stated otherwise, listing a business on EveBash does not constitute EveBash's endorsement, certification, guarantee, or recommendation of that business.
              </p>
              <p>
                Transactions or agreements between users and independently operated businesses may be subject to separate terms between those parties.
              </p>
            </>
          ),
        },
        {
          title: "16. EB Network",
          content: (
            <>
              <p>
                EveBash may provide discovery, networking, marketplace-like, or professional connection features under <strong>EB Network</strong> or related services.
              </p>
              <p>
                Users and businesses are responsible for independently evaluating persons or organizations they interact with through such features.
              </p>
              <p>
                Unless EveBash expressly acts as a party to a transaction, EveBash is not automatically a party to agreements entered into directly between independent users or businesses.
              </p>
            </>
          ),
        },
        {
          title: "17. Plans and Subscriptions",
          content: (
            <>
              <p>EveBash may offer free and paid plans.</p>
              <p>Plans may differ according to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>storage;</li>
                <li>number of events;</li>
                <li>number of galleries;</li>
                <li>upload limits;</li>
                <li>business listings;</li>
                <li>media-processing features;</li>
                <li>Find You availability;</li>
                <li>collaboration features;</li>
                <li>administrative features; and</li>
                <li>other product limits.</li>
              </ul>
              <p>
                The specific limits and benefits applicable to a plan will be shown at the time of purchase or subscription.
              </p>
            </>
          ),
        },
        {
          title: "18. Pricing",
          content: (
            <>
              <p>
                Prices may vary by plan, billing period, location, taxes, promotional offers, or other applicable factors.
              </p>
              <p>
                EveBash may change future pricing, plan structures, or included features.
              </p>
              <p>
                Where required by law or applicable contractual commitments, users will receive appropriate notice before changes affecting an existing paid subscription take effect.
              </p>
              <p>
                A pricing change will not retroactively alter a completed purchase unless permitted by law or agreed with the user.
              </p>
            </>
          ),
        },
        {
          title: "19. Payments",
          content: (
            <>
              <p>
                Payments may be processed using third-party payment providers such as Razorpay or other providers selected by EveBash.
              </p>
              <p>
                By making a payment, you may also be subject to the payment provider's applicable terms and privacy practices.
              </p>
              <p>
                EveBash does not require users to provide payment-card credentials directly to EveBash where those credentials are securely collected by the payment provider.
              </p>
              <p>
                A plan or paid feature may not be activated until EveBash receives reliable confirmation that payment has been successfully completed.
              </p>
            </>
          ),
        },
        {
          title: "20. Taxes",
          content: (
            <>
              <p>Prices may include or exclude GST or other applicable taxes as indicated during purchase.</p>
              <p>Users are responsible for taxes, duties, or charges applicable to their purchase where required by law.</p>
              <p>EveBash will collect, report, or remit taxes where legally required.</p>
            </>
          ),
        },
        {
          title: "21. Renewals and Recurring Payments",
          content: (
            <>
              <p>
                If EveBash offers automatically renewing subscriptions, the applicable billing period, renewal terms, price, and cancellation method will be disclosed before purchase.
              </p>
              <p>
                Where recurring payment authorization is used, users authorize the applicable payment provider to process payments in accordance with the subscription selected.
              </p>
              <p>
                Users may cancel recurring subscriptions according to the cancellation options made available by EveBash and applicable law.
              </p>
            </>
          ),
        },
        {
          title: "22. Cancellations and Refunds",
          content: (
            <>
              <p>
                Cancellation and refund eligibility may depend on the purchased plan, billing arrangement, amount of service already consumed, applicable promotional terms, and applicable law.
              </p>
              <p>
                Detailed cancellation and refund rules may be provided in a separate <strong>Cancellation & Refund Policy</strong>.
              </p>
              <p>
                Nothing in these Terms limits refund or cancellation rights that users are entitled to under applicable law.
              </p>
            </>
          ),
        },
        {
          title: "23. Plan Expiration and Downgrades",
          content: (
            <>
              <p>
                When a paid subscription expires, is cancelled, or is downgraded, some features may become unavailable.
              </p>
              <p>
                If stored content exceeds the allowance of the new plan, EveBash may temporarily restrict new uploads or certain account functionality.
              </p>
              <p>
                Where reasonably practical, EveBash may provide users an opportunity to upgrade, renew, download eligible content, or reduce storage usage before content is permanently removed solely because of a plan change.
              </p>
              <p>
                Specific retention periods may be communicated through the applicable plan or retention policy.
              </p>
            </>
          ),
        },
        {
          title: "24. Comments, Likes and Community Features",
          content: (
            <>
              <p>
                Where EveBash permits comments, likes, reactions, or other community interactions, users must use those features responsibly.
              </p>
              <p>
                Users must not use community features for unlawful harassment, spam, impersonation, abuse, fraud, or other prohibited conduct.
              </p>
              <p>
                Event organizers may be provided tools to moderate interactions within their galleries or events.
              </p>
            </>
          ),
        },
        {
          title: "25. EveBash Intellectual Property",
          content: (
            <>
              <p>The EveBash platform, excluding User Content, may include proprietary:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>software;</li>
                <li>source code;</li>
                <li>designs;</li>
                <li>interfaces;</li>
                <li>graphics;</li>
                <li>logos;</li>
                <li>trademarks;</li>
                <li>branding;</li>
                <li>documentation;</li>
                <li>templates; and</li>
                <li>other intellectual property.</li>
              </ul>
              <p>
                These materials are owned by EveBash or its applicable licensors and are protected by applicable intellectual-property laws.
              </p>
              <p>Using EveBash does not transfer ownership of EveBash intellectual property to you.</p>
              <p>
                You may not copy, sell, license, reverse engineer, redistribute, or exploit protected EveBash materials except where permitted by law or expressly authorized by EveBash.
              </p>
            </>
          ),
        },
        {
          title: "26. Copyright and Intellectual-Property Complaints",
          content: (
            <>
              <p>EveBash respects intellectual-property rights.</p>
              <p>
                If you believe content available through EveBash infringes rights you own or are authorized to enforce, you may submit a complaint through EveBash's designated contact process.
              </p>
              <p>A complaint should provide sufficient information to identify:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>the protected work or right;</li>
                <li>the allegedly infringing content;</li>
                <li>where the content appears;</li>
                <li>the complainant;</li>
                <li>the basis of the complaint; and</li>
                <li>appropriate contact information.</li>
              </ul>
              <p>
                EveBash may remove or restrict disputed content where required or reasonably appropriate while reviewing a complaint.
              </p>
            </>
          ),
        },
        {
          title: "27. Privacy",
          content: (
            <>
              <p>
                Use of EveBash is also governed by the EveBash <strong>Privacy Policy</strong>.
              </p>
              <p>The Privacy Policy should explain matters including:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>information EveBash collects;</li>
                <li>account information;</li>
                <li>authentication data;</li>
                <li>uploaded media;</li>
                <li>event information;</li>
                <li>device and technical information;</li>
                <li>cookies and similar technologies;</li>
                <li>payment-related information;</li>
                <li>media-processing activities;</li>
                <li>facial processing where applicable;</li>
                <li>service providers;</li>
                <li>data retention;</li>
                <li>user rights; and</li>
                <li>data-security practices.</li>
              </ul>
              <p>These Terms and the Privacy Policy should be read together.</p>
            </>
          ),
        },
        {
          title: "28. Security",
          content: (
            <>
              <p>
                EveBash may implement technical and organizational measures intended to protect accounts, media, and other information.
              </p>
              <p>Users also play an important role in security.</p>
              <p>You must not:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>attempt unauthorized access;</li>
                <li>probe or attack EveBash systems without authorization;</li>
                <li>distribute malware;</li>
                <li>interfere with the Services;</li>
                <li>exploit vulnerabilities;</li>
                <li>bypass usage restrictions;</li>
                <li>scrape protected information unlawfully;</li>
                <li>abuse APIs; or</li>
                <li>use automated systems in a manner that materially harms the Services.</li>
              </ul>
              <p>
                Security vulnerabilities should be reported responsibly through EveBash's designated contact channel.
              </p>
            </>
          ),
        },
        {
          title: "29. Third-Party Services",
          content: (
            <>
              <p>
                EveBash may rely on third-party infrastructure and service providers for functions such as:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>hosting;</li>
                <li>databases;</li>
                <li>authentication;</li>
                <li>media storage;</li>
                <li>content delivery;</li>
                <li>payments;</li>
                <li>email;</li>
                <li>analytics;</li>
                <li>background processing;</li>
                <li>artificial intelligence;</li>
                <li>video processing; and</li>
                <li>security.</li>
              </ul>
              <p>
                The availability of some EveBash features may therefore depend partly on third-party systems.
              </p>
              <p>
                Where applicable, users may also be subject to third-party terms when directly interacting with those services.
              </p>
            </>
          ),
        },
        {
          title: "30. Service Availability",
          content: (
            <>
              <p>
                EveBash aims to provide reliable Services but does not guarantee that every feature will be available continuously or without interruption.
              </p>
              <p>Temporary disruption may occur because of:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>maintenance;</li>
                <li>updates;</li>
                <li>infrastructure failures;</li>
                <li>network outages;</li>
                <li>security incidents;</li>
                <li>third-party service interruptions;</li>
                <li>force majeure events; or</li>
                <li>circumstances beyond reasonable control.</li>
              </ul>
              <p>
                EveBash may perform maintenance or temporarily restrict features where reasonably necessary for security, stability, or legal compliance.
              </p>
            </>
          ),
        },
        {
          title: "31. Service Changes",
          content: (
            <>
              <p>EveBash may update, improve, redesign, replace, or discontinue features.</p>
              <p>Changes may be made to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>improve performance;</li>
                <li>add functionality;</li>
                <li>address security issues;</li>
                <li>comply with law;</li>
                <li>improve user experience;</li>
                <li>respond to infrastructure changes; or</li>
                <li>maintain the viability of the Services.</li>
              </ul>
              <p>
                Where a material change significantly affects an existing paid service, EveBash will provide notice where required by applicable law.
              </p>
            </>
          ),
        },
        {
          title: "32. Suspension",
          content: (
            <>
              <p>
                EveBash may temporarily suspend an account or feature where reasonably necessary because of:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>serious or repeated violations of these Terms;</li>
                <li>prohibited content;</li>
                <li>fraudulent activity;</li>
                <li>payment issues;</li>
                <li>security risks;</li>
                <li>unauthorized access;</li>
                <li>abuse of infrastructure;</li>
                <li>legal requirements; or</li>
                <li>risks to EveBash or other users.</li>
              </ul>
              <p>
                Where appropriate and legally permitted, EveBash may provide notice or an opportunity to resolve the issue.
              </p>
            </>
          ),
        },
        {
          title: "33. Account Termination",
          content: (
            <>
              <p>
                Users may terminate their EveBash account using the available account-deletion process or by contacting EveBash where appropriate.
              </p>
              <p>
                EveBash may terminate accounts for serious or repeated violations of these Terms or where legally required.
              </p>
              <p>
                Termination may result in loss of access to events, galleries, business listings, subscriptions, or other account features.
              </p>
            </>
          ),
        },
        {
          title: "34. Data Deletion and Retention",
          content: (
            <>
              <p>
                Deleting an account or media does not necessarily result in instantaneous deletion from every technical system.
              </p>
              <p>Some information may remain temporarily in:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>backups;</li>
                <li>caches;</li>
                <li>processing systems;</li>
                <li>logs; or</li>
                <li>security records.</li>
              </ul>
              <p>Certain information may also be retained where reasonably necessary for:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>legal obligations;</li>
                <li>tax/accounting requirements;</li>
                <li>fraud prevention;</li>
                <li>payment disputes;</li>
                <li>security;</li>
                <li>enforcing agreements; or</li>
                <li>resolving disputes.</li>
              </ul>
              <p>Further information should be provided in the EveBash Privacy Policy.</p>
            </>
          ),
        },
        {
          title: "35. Disclaimer of Warranties",
          content: (
            <>
              <p>
                To the extent permitted by applicable law, EveBash is provided on an &quot;as available&quot; basis.
              </p>
              <p>EveBash does not guarantee that:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>the Services will always be uninterrupted;</li>
                <li>every feature will always be available;</li>
                <li>all software will be entirely error-free;</li>
                <li>every uploaded file can always be recovered;</li>
                <li>automated moderation will identify every prohibited item;</li>
                <li>facial matching will always produce correct results; or</li>
                <li>third-party services will remain continuously available.</li>
              </ul>
              <p>Nothing in these Terms excludes warranties or rights that cannot legally be excluded.</p>
            </>
          ),
        },
        {
          title: "36. Limitation of Liability",
          content: (
            <>
              <p>
                To the maximum extent permitted by applicable law, EveBash will not be liable for indirect, incidental, special, consequential, or similar losses arising from use of the Services where such liability may lawfully be limited.
              </p>
              <p>
                This may include loss resulting from unauthorized sharing by users, interruption of third-party infrastructure, loss of business opportunity, or loss of data where the loss was outside EveBash's reasonable control.
              </p>
              <p>
                Any monetary limitation of liability applicable to paid Services should be stated clearly in the final legally reviewed version of these Terms.
              </p>
              <p>
                Nothing in these Terms limits liability that cannot legally be limited or excluded under applicable law.
              </p>
            </>
          ),
        },
        {
          title: "37. Indemnification",
          content: (
            <>
              <p>
                To the extent permitted by applicable law, users may be responsible for claims, losses, or reasonable costs resulting from their unlawful use of EveBash, violation of these Terms, infringement of another person's rights, or User Content they were not legally authorized to upload or distribute.
              </p>
              <p>
                The final scope of any indemnification obligation should be interpreted consistently with applicable law.
              </p>
            </>
          ),
        },
        {
          title: "38. Governing Law",
          content: (
            <>
              <p>
                These Terms will be governed by the laws of India, subject to any mandatory rights or legal protections that apply to users under applicable law.
              </p>
              <p>
                The appropriate courts, jurisdiction, and dispute-resolution mechanism should be specified in the final version based on EveBash's legal business entity and registered place of business.
              </p>
            </>
          ),
        },
        {
          title: "39. Changes to These Terms",
          content: (
            <>
              <p>EveBash may update these Terms from time to time.</p>
              <p>The &quot;Last updated&quot; date will indicate when the Terms were most recently revised.</p>
              <p>
                For material changes, EveBash may provide additional notice through the website, application, email, account dashboard, or another appropriate method where required.
              </p>
              <p>
                Continued use after revised Terms become effective constitutes acceptance to the extent permitted by applicable law.
              </p>
              <p>Where explicit consent is legally required, EveBash will request it.</p>
            </>
          ),
        },
        {
          title: "40. Severability",
          content: (
            <p>
              If any provision of these Terms is found to be unlawful, invalid, or unenforceable, the remaining provisions will continue to apply to the extent permitted by law.
            </p>
          ),
        },
        {
          title: "41. No Waiver",
          content: (
            <p>
              If EveBash does not immediately enforce a provision of these Terms, that does not necessarily waive EveBash's right to enforce it later.
            </p>
          ),
        },
        {
          title: "42. Entire Agreement",
          content: (
            <>
              <p>
                These Terms, together with applicable EveBash policies and any additional terms expressly agreed for a particular service, constitute the agreement governing use of the Services.
              </p>
              <p>Relevant policies may include the:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Privacy Policy;</li>
                <li>Content Policy;</li>
                <li>Cancellation & Refund Policy;</li>
                <li>Cookie Policy; and</li>
                <li>applicable plan or subscription terms.</li>
              </ul>
            </>
          ),
        },
        {
          title: "43. Contact EveBash",
          content: (
            <>
              <p>Questions about these Terms or the EveBash Services may be sent to:</p>
              <div className="mt-2 space-y-1 rounded-xl bg-[var(--site-card-muted)] p-4 text-sm">
                <p><strong>EveBash</strong></p>
                <p><strong>Support:</strong> <a href="mailto:support@evebash.com" className="font-semibold text-sky-400">support@evebash.com</a></p>
                <p><strong>Website:</strong> evebash.com</p>
              </div>
              <p className="mt-3 text-xs text-[var(--site-muted)]">
                Additional legal entity name, registered address, grievance/contact officer information, and other legally required details should be added before public launch.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
