import { LegalPolicyScreen } from '@/components/LegalPolicyScreen';

export default function TermsAndConditionsScreen() {
  return (
    <LegalPolicyScreen
      title="Terms & Conditions"
      lastUpdated="August 14, 2026"
      description="These Terms & Conditions govern your access to and use of EveBash websites, applications, accounts, galleries, event-management features, media-upload and sharing services, business features, subscriptions, find You features, and other services provided through EveBash. By creating an account, accessing EveBash, purchasing a plan, uploading content, creating or joining an event or gallery, or otherwise using the Services, you agree to these Terms & Conditions. If you do not agree to these Terms, you should not use the Services."
      sections={[
        {
          title: '1. About EveBash',
          paragraphs: [
            'EveBash is a digital event and media platform that enables users to create and manage events and galleries, upload and organize photographs and videos, share event media with authorized users or guests, discover event-related businesses and services where available, and use additional features offered by EveBash.',
            'Certain features may vary according to the user\'s plan, location, device, account type, or availability.',
            'EveBash may introduce, modify, replace, or discontinue features in accordance with these Terms.',
          ],
        },
        {
          title: '2. Eligibility',
          paragraphs: [
            'You may use EveBash only if you are legally capable of entering into a binding agreement under applicable law.',
            'If you use EveBash on behalf of a company, organization, event organizer, photography business, or another legal entity, you represent that you have authority to accept these Terms on its behalf.',
            'Where additional consent is required for minors or other persons under applicable law, the account holder, organizer, uploader, or responsible adult must obtain the required consent before using EveBash in relation to those persons.',
          ],
        },
        {
          title: '3. User Accounts',
          paragraphs: [
            'Certain EveBash Services require an account.',
            'You agree to: provide accurate and reasonably current account information; keep your login credentials secure; not knowingly allow unauthorized persons to use your account; promptly notify EveBash if you believe your account has been compromised; and take reasonable responsibility for activities performed through your account.',
            'You must not impersonate another person or organization or create an account using information you are not authorized to use.',
            'EveBash may require email verification, identity verification, additional authentication, or other reasonable security measures.',
          ],
        },
        {
          title: '4. Event Hosts and Organizers',
          paragraphs: [
            'Users may be able to create events, galleries, invitations, access links, guest experiences, or other event-related resources.',
            'An event host or organizer is responsible for managing access to their event and determining who may access private galleries or other restricted content.',
            'Event hosts must use reasonable care when sharing: gallery links; invitations; QR codes; access codes; passwords; guest credentials; or other private access mechanisms.',
            'EveBash is not responsible for unauthorized access resulting from an organizer or authorized user voluntarily sharing private access information with another person, except to the extent responsibility cannot legally be excluded.',
          ],
        },
        {
          title: '5. Guests and Gallery Access',
          paragraphs: [
            'Guests may receive access to event galleries or other content through invitations, links, QR codes, credentials, or other mechanisms.',
            'Access to a gallery does not transfer ownership of its photographs, videos, or other content.',
            'Guests must respect any restrictions imposed by the event organizer, content owner, photographer, or applicable law.',
            'Users must not attempt to bypass access controls or obtain access to galleries, events, accounts, media, or information they are not authorized to access.',
          ],
        },
        {
          title: '6. User Content',
          paragraphs: [
            '"User Content" includes photographs, videos, profile information, comments, captions, business information, event information, logos, text, files, and other material submitted, uploaded, created, or shared through EveBash.',
            'You retain ownership: EveBash does not claim ownership of your User Content.',
            'Subject to the rights of photographers, creators, event organizers, guests, or other applicable rights holders, you retain the rights you have in the content you upload.',
          ],
        },
        {
          title: '7. Permission Granted to EveBash',
          paragraphs: [
            'To operate the Services, you grant EveBash a limited, non-exclusive license to process User Content solely as reasonably necessary to provide, secure, maintain, improve, and operate the Services.',
            'This may include the technical right to: upload and store content; copy content for technical processing; display content to authorized users; deliver content through networks and content-delivery systems; resize photographs; compress media; create thumbnails and previews; transcode videos; generate streaming formats; extract technical metadata; perform security and moderation checks; perform authorized search, indexing, and matching operations; create technical backups or temporary processing copies; and otherwise process content as necessary to provide features requested or enabled by users.',
            'This license does not give EveBash ownership of your User Content. EveBash will not acquire the right to sell your photographs or videos merely because you uploaded them to the Services.',
            'The license exists for purposes connected with operating and providing EveBash and ends when the relevant content is deleted, subject to reasonable technical retention, backups, legal requirements, fraud prevention, dispute resolution, and other legitimate retention requirements described in EveBash policies.',
          ],
        },
        {
          title: '8. Your Responsibility for Uploaded Content',
          paragraphs: [
            'You are responsible for User Content you upload or make available through EveBash.',
            'By uploading content, you represent that you have the rights, permissions, licenses, or other lawful basis necessary to upload, process, store, display, and share that content through the Services.',
            'For example, depending on the circumstances, these rights may belong to: you; a photographer; an event organizer; a client; an employer; another copyright owner; or persons appearing in the media.',
            'You must not knowingly upload content in a manner that infringes another person\'s intellectual-property, privacy, publicity, confidentiality, or other legal rights.',
          ],
        },
        {
          title: '9. Prohibited Content',
          paragraphs: [
            'EveBash must not be used to upload, store, distribute, promote, or facilitate content that is unlawful or prohibited under these Terms.',
            'Prohibited content may include: child sexual abuse or exploitation material; sexual exploitation of minors; non-consensual intimate imagery; unlawful sexually explicit material; content promoting or facilitating serious illegal activity; content unlawfully threatening or harassing another person; material that unlawfully violates another person\'s privacy; content that infringes copyrights, trademarks, or other intellectual-property rights; malicious software or files intended to damage systems; fraudulent or deceptive content intended to cause unlawful harm; content prohibited by applicable law; and other content EveBash reasonably determines presents a serious legal, security, or safety risk.',
            'EveBash may establish additional content standards through a separate Content Policy.',
          ],
        },
        {
          title: '10. Content Moderation',
          paragraphs: [
            'EveBash may use a combination of automated systems, technical detection systems, user reports, administrator review, and manual review to identify content or conduct that may violate these Terms or applicable law.',
            'Where reasonably appropriate, content may be classified as safe, restricted, requiring review, or prohibited.',
            'EveBash may restrict publication, temporarily quarantine content, limit access, remove content, disable sharing, request additional information, suspend relevant features, suspend an account, or terminate an account where reasonably necessary to enforce these Terms, protect users, maintain platform security, or comply with applicable law.',
            'Automated systems may make mistakes. Where EveBash provides an appeal or review process, users may use that process to request reconsideration.',
          ],
        },
        {
          title: '11. Find You and Facial Matching',
          paragraphs: [
            'EveBash may provide a feature referred to as Find You or a similar feature that helps an authorized user locate photographs in which they may appear.',
            'Where enabled, the feature may process a submitted photograph or facial image and create a mathematical representation or embedding used to compare the submitted face with faces detected in eligible gallery photographs.',
            'The feature is intended to help users locate relevant media within authorized EveBash galleries.',
            'Use of Find You is subject to EveBash\'s Privacy Policy and any additional notices or consent requirements presented when the feature is used.',
            'Users must not use Find You to: identify or track people for unlawful purposes; stalk or harass another person; circumvent gallery-access restrictions; conduct unauthorized surveillance; or otherwise violate applicable law or another person\'s rights.',
            'Availability of Find You may depend on the event, gallery, jurisdiction, account settings, consent requirements, and technical availability.',
            'Facial matching is probabilistic and may produce incorrect matches or fail to identify relevant photographs. Users should therefore not treat Find You results as definitive proof of a person\'s identity or presence.',
          ],
        },
        {
          title: '12. Media Processing',
          paragraphs: [
            'To provide digital-gallery functionality, EveBash may technically process uploaded images and videos.',
            'Processing may include: image resizing; thumbnail generation; preview generation; compression; format conversion; video transcoding; video thumbnail extraction; streaming preparation; metadata extraction; duplicate or integrity checks; content moderation; and authorized facial processing where applicable.',
            'Processing may be performed using EveBash infrastructure or third-party infrastructure providers acting in connection with the Services.',
          ],
        },
        {
          title: '13. Storage',
          paragraphs: [
            'EveBash plans may provide different storage allowances.',
            'Storage limits may apply to: photographs; videos; thumbnails; previews; derived media; event content; and other files associated with an account.',
            'The applicable storage allowance will be shown with the relevant plan or account. Users must not deliberately circumvent storage limitations.',
            'If an account exceeds its permitted storage, EveBash may restrict additional uploads, request an upgrade, provide an opportunity to remove content, or take other reasonable action consistent with the applicable plan.',
          ],
        },
        {
          title: '14. Backups and Original Media',
          paragraphs: [
            'EveBash uses infrastructure and operational measures intended to provide reliable media storage and delivery.',
            'However, no online storage system can guarantee permanent or uninterrupted preservation of every file.',
            'Unless EveBash expressly offers a separate guaranteed archival service, users should maintain their own copies of important original photographs, videos, and other irreplaceable media.',
            'EveBash should not be treated as the sole archival copy of irreplaceable media. Nothing in this section excludes liability that cannot lawfully be excluded.',
          ],
        },
        {
          title: '15. Business Features and EB Business',
          paragraphs: [
            'EveBash may allow businesses, photographers, event professionals, vendors, or service providers to create profiles or listings through features such as EB Business.',
            'Businesses are responsible for the accuracy of information they publish, including descriptions, contact information, availability, pricing, services, portfolios, and other representations.',
            'Unless expressly stated otherwise, listing a business on EveBash does not constitute EveBash\'s endorsement, certification, guarantee, or recommendation of that business.',
            'Transactions or agreements between users and independently operated businesses may be subject to separate terms between those parties.',
          ],
        },
        {
          title: '16. EB Network',
          paragraphs: [
            'EveBash may provide discovery, networking, marketplace-like, or professional connection features under EB Network or related services.',
            'Users and businesses are responsible for independently evaluating persons or organizations they interact with through such features.',
            'Unless EveBash expressly acts as a party to a transaction, EveBash is not automatically a party to agreements entered into directly between independent users or businesses.',
          ],
        },
        {
          title: '17. Plans and Subscriptions',
          paragraphs: [
            'EveBash may offer free and paid plans.',
            'Plans may differ according to: storage; number of events; number of galleries; upload limits; business listings; media-processing features; Find You availability; collaboration features; administrative features; and other product limits.',
            'The specific limits and benefits applicable to a plan will be shown at the time of purchase or subscription.',
          ],
        },
        {
          title: '18. Pricing',
          paragraphs: [
            'Prices may vary by plan, billing period, location, taxes, promotional offers, or other applicable factors.',
            'EveBash may change future pricing, plan structures, or included features.',
            'Where required by law or applicable contractual commitments, users will receive appropriate notice before changes affecting an existing paid subscription take effect.',
            'A pricing change will not retroactively alter a completed purchase unless permitted by law or agreed with the user.',
          ],
        },
        {
          title: '19. Payments',
          paragraphs: [
            'Payments may be processed using third-party payment providers such as Razorpay or other providers selected by EveBash.',
            'By making a payment, you may also be subject to the payment provider\'s applicable terms and privacy practices.',
            'EveBash does not require users to provide payment-card credentials directly to EveBash where those credentials are securely collected by the payment provider.',
            'A plan or paid feature may not be activated until EveBash receives reliable confirmation that payment has been successfully completed.',
          ],
        },
        {
          title: '20. Taxes',
          paragraphs: [
            'Prices may include or exclude GST or other applicable taxes as indicated during purchase.',
            'Users are responsible for taxes, duties, or charges applicable to their purchase where required by law.',
            'EveBash will collect, report, or remit taxes where legally required.',
          ],
        },
        {
          title: '21. Renewals and Recurring Payments',
          paragraphs: [
            'If EveBash offers automatically renewing subscriptions, the applicable billing period, renewal terms, price, and cancellation method will be disclosed before purchase.',
            'Where recurring payment authorization is used, users authorize the applicable payment provider to process payments in accordance with the subscription selected.',
            'Users may cancel recurring subscriptions according to the cancellation options made available by EveBash and applicable law.',
          ],
        },
        {
          title: '22. Cancellations and Refunds',
          paragraphs: [
            'Cancellation and refund eligibility may depend on the purchased plan, billing arrangement, amount of service already consumed, applicable promotional terms, and applicable law.',
            'Detailed cancellation and refund rules may be provided in a separate Cancellation & Refund Policy.',
            'Nothing in these Terms limits refund or cancellation rights that users are entitled to under applicable law.',
          ],
        },
        {
          title: '23. Plan Expiration and Downgrades',
          paragraphs: [
            'When a paid subscription expires, is cancelled, or is downgraded, some features may become unavailable.',
            'If stored content exceeds the allowance of the new plan, EveBash may temporarily restrict new uploads or certain account functionality.',
            'Where reasonably practical, EveBash may provide users an opportunity to upgrade, renew, download eligible content, or reduce storage usage before content is permanently removed solely because of a plan change.',
            'Specific retention periods may be communicated through the applicable plan or retention policy.',
          ],
        },
        {
          title: '24. Comments, Likes and Community Features',
          paragraphs: [
            'Where EveBash permits comments, likes, reactions, or other community interactions, users must use those features responsibly.',
            'Users must not use community features for unlawful harassment, spam, impersonation, abuse, fraud, or other prohibited conduct.',
            'Event organizers may be provided tools to moderate interactions within their galleries or events.',
          ],
        },
        {
          title: '25. EveBash Intellectual Property',
          paragraphs: [
            'The EveBash platform, excluding User Content, may include proprietary software, source code, designs, interfaces, graphics, logos, trademarks, branding, documentation, templates, and other intellectual property.',
            'These materials are owned by EveBash or its applicable licensors and are protected by applicable intellectual-property laws.',
            'Using EveBash does not transfer ownership of EveBash intellectual property to you. You may not copy, sell, license, reverse engineer, redistribute, or exploit protected EveBash materials except where permitted by law or expressly authorized by EveBash.',
          ],
        },
        {
          title: '26. Copyright and Intellectual-Property Complaints',
          paragraphs: [
            'EveBash respects intellectual-property rights.',
            'If you believe content available through EveBash infringes rights you own or are authorized to enforce, you may submit a complaint through EveBash\'s designated contact process.',
            'A complaint should provide sufficient information to identify: the protected work or right; the allegedly infringing content; where the content appears; the complainant; the basis of the complaint; and appropriate contact information.',
            'EveBash may remove or restrict disputed content where required or reasonably appropriate while reviewing a complaint.',
          ],
        },
        {
          title: '27. Privacy',
          paragraphs: [
            'Use of EveBash is also governed by the EveBash Privacy Policy.',
            'The Privacy Policy explains matters including: information EveBash collects; account information; authentication data; uploaded media; event information; device and technical information; cookies and similar technologies; payment-related information; media-processing activities; facial processing where applicable; service providers; data retention; user rights; and data-security practices.',
            'These Terms and the Privacy Policy should be read together.',
          ],
        },
        {
          title: '28. Security',
          paragraphs: [
            'EveBash may implement technical and organizational measures intended to protect accounts, media, and other information.',
            'Users also play an important role in security. You must not: attempt unauthorized access; probe or attack EveBash systems without authorization; distribute malware; interfere with the Services; exploit vulnerabilities; bypass usage restrictions; scrape protected information unlawfully; abuse APIs; or use automated systems in a manner that materially harms the Services.',
            'Security vulnerabilities should be reported responsibly through EveBash\'s designated contact channel.',
          ],
        },
        {
          title: '29. Third-Party Services',
          paragraphs: [
            'EveBash may rely on third-party infrastructure and service providers for functions such as hosting, databases, authentication, media storage, content delivery, payments, email, analytics, background processing, artificial intelligence, video processing, and security.',
            'The availability of some EveBash features may therefore depend partly on third-party systems.',
            'Where applicable, users may also be subject to third-party terms when directly interacting with those services.',
          ],
        },
        {
          title: '30. Service Availability',
          paragraphs: [
            'EveBash aims to provide reliable Services but does not guarantee that every feature will be available continuously or without interruption.',
            'Temporary disruption may occur because of maintenance, updates, infrastructure failures, network outages, security incidents, third-party service interruptions, force majeure events, or circumstances beyond reasonable control.',
            'EveBash may perform maintenance or temporarily restrict features where reasonably necessary for security, stability, or legal compliance.',
          ],
        },
        {
          title: '31. Service Changes',
          paragraphs: [
            'EveBash may update, improve, redesign, replace, or discontinue features.',
            'Changes may be made to improve performance, add functionality, address security issues, comply with law, improve user experience, respond to infrastructure changes, or maintain the viability of the Services.',
            'Where a material change significantly affects an existing paid service, EveBash will provide notice where required by applicable law.',
          ],
        },
        {
          title: '32. Suspension',
          paragraphs: [
            'EveBash may temporarily suspend an account or feature where reasonably necessary because of serious or repeated violations of these Terms, prohibited content, fraudulent activity, payment issues, security risks, unauthorized access, abuse of infrastructure, legal requirements, or risks to EveBash or other users.',
            'Where appropriate and legally permitted, EveBash may provide notice or an opportunity to resolve the issue.',
          ],
        },
        {
          title: '33. Account Termination',
          paragraphs: [
            'Users may terminate their EveBash account using the available account-deletion process or by contacting EveBash where appropriate.',
            'EveBash may terminate accounts for serious or repeated violations of these Terms or where legally required.',
            'Termination may result in loss of access to events, galleries, business listings, subscriptions, or other account features.',
          ],
        },
        {
          title: '34. Data Deletion and Retention',
          paragraphs: [
            'Deleting an account or media does not necessarily result in instantaneous deletion from every technical system.',
            'Some information may remain temporarily in backups, caches, processing systems, logs, or security records.',
            'Certain information may also be retained where reasonably necessary for legal obligations, tax/accounting requirements, fraud prevention, payment disputes, security, enforcing agreements, or resolving disputes.',
            'Further information should be provided in the EveBash Privacy Policy.',
          ],
        },
        {
          title: '35. Disclaimer of Warranties',
          paragraphs: [
            'To the extent permitted by applicable law, EveBash is provided on an "as available" basis.',
            'EveBash does not guarantee that: the Services will always be uninterrupted; every feature will always be available; all software will be entirely error-free; every uploaded file can always be recovered; automated moderation will identify every prohibited item; facial matching will always produce correct results; or third-party services will remain continuously available.',
            'Nothing in these Terms excludes warranties or rights that cannot legally be excluded.',
          ],
        },
        {
          title: '36. Limitation of Liability',
          paragraphs: [
            'To the maximum extent permitted by applicable law, EveBash will not be liable for indirect, incidental, special, consequential, or similar losses arising from use of the Services where such liability may lawfully be limited.',
            'This may include loss resulting from unauthorized sharing by users, interruption of third-party infrastructure, loss of business opportunity, or loss of data where the loss was outside EveBash\'s reasonable control.',
            'Any monetary limitation of liability applicable to paid Services should be stated clearly in the final legally reviewed version of these Terms.',
            'Nothing in these Terms limits liability that cannot legally be limited or excluded under applicable law.',
          ],
        },
        {
          title: '37. Indemnification',
          paragraphs: [
            'To the extent permitted by applicable law, users may be responsible for claims, losses, or reasonable costs resulting from their unlawful use of EveBash, violation of these Terms, infringement of another person\'s rights, or User Content they were not legally authorized to upload or distribute.',
            'The final scope of any indemnification obligation should be interpreted consistently with applicable law.',
          ],
        },
        {
          title: '38. Governing Law',
          paragraphs: [
            'These Terms will be governed by the laws of India, subject to any mandatory rights or legal protections that apply to users under applicable law.',
            'The appropriate courts, jurisdiction, and dispute-resolution mechanism should be specified in the final version based on EveBash\'s legal business entity and registered place of business.',
          ],
        },
        {
          title: '39. Changes to These Terms',
          paragraphs: [
            'EveBash may update these Terms from time to time.',
            'The "Last updated" date will indicate when the Terms were most recently revised.',
            'For material changes, EveBash may provide additional notice through the website, application, email, account dashboard, or another appropriate method where required.',
            'Continued use after revised Terms become effective constitutes acceptance to the extent permitted by applicable law. Where explicit consent is legally required, EveBash will request it.',
          ],
        },
        {
          title: '40. Severability',
          paragraphs: [
            'If any provision of these Terms is found to be unlawful, invalid, or unenforceable, the remaining provisions will continue to apply to the extent permitted by law.',
          ],
        },
        {
          title: '41. No Waiver',
          paragraphs: [
            'If EveBash does not immediately enforce a provision of these Terms, that does not necessarily waive EveBash\'s right to enforce it later.',
          ],
        },
        {
          title: '42. Entire Agreement',
          paragraphs: [
            'These Terms, together with applicable EveBash policies and any additional terms expressly agreed for a particular service, constitute the agreement governing use of the Services.',
            'Relevant policies may include the: Privacy Policy; Content Policy; Cancellation & Refund Policy; Cookie Policy; and applicable plan or subscription terms.',
          ],
        },
        {
          title: '43. Contact EveBash',
          paragraphs: [
            'Questions about these Terms or the EveBash Services may be sent to: EveBash | Support: support@evebash.com | Website: evebash.com',
            'Additional legal entity name, registered address, grievance/contact officer information, and other legally required details should be added before public launch.',
          ],
        },
      ]}
    />
  );
}
