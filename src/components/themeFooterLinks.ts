// Links in the footers that some guest-page themes draw instead of the shared event footer (src/components/Footer.tsx):
// Confetti Circle (confetti/ConfettiFooter.tsx) and Sunlit Portrait (portrait/PortraitFooter.tsx). One list, so the
// themes never drift apart.

export const THEME_FOOTER_LEFT_LINKS = [
    { href: "/login?mode=signup", label: "Create your own event" },
    { href: "/sample-galleries", label: "Sample galleries" },
    { href: "/pricing", label: "Pricing" },
];

export const THEME_FOOTER_RIGHT_LINKS = [
    { href: "/privacy-policy", label: "Privacy" },
    { href: "/terms-and-conditions", label: "Terms" },
    { href: "/contact-us", label: "Contact us" },
];
