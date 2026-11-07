// Website and app (one copy): a theme's own content on the guest page (todo #10), kept in events.theme_content on
// the main event (albums show their main event's). One block per kind of content; a theme shows the blocks it has a
// place for, and only what the host filled in. Blocks today: the couple (Confetti Circle's bride and groom). A later
// block (how we met, milestones...) adds its key, type and checks here; the column and the save call stay the same
// (set_theme_content_block in supabase/migrations/20261107120000_theme_content.sql).
//
// Nothing here is guessed: names never come from the gallery title, since a title can name other people.

export const SOCIAL_NETWORKS = ["instagram", "facebook", "x"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_NETWORK_NAMES: Readonly<Record<SocialNetwork, string>> = { instagram: "Instagram", facebook: "Facebook", x: "X" };

export interface CouplePerson {
    /** What the side is called above the name ("The Bride"); the host picks it */
    label: string;
    name: string;
    /** A few words about them */
    about: string;
    /** Saved as full https links (socialLinkUrl); a network with no link is left out */
    links: Partial<Record<SocialNetwork, string>>;
}

export type CoupleSide = "left" | "right";
export const COUPLE_SIDES: readonly CoupleSide[] = ["left", "right"];

/** A side nobody filled in is left out */
export type CoupleBlock = Partial<Record<CoupleSide, CouplePerson>>;

export interface ThemeContent {
    couple?: CoupleBlock;
}

export type ThemeContentBlock = keyof ThemeContent;

export const COUPLE_LIMITS = { label: 24, name: 40, about: 160, link: 200 } as const;

/** What the two sides are called until the host changes it: the bride and groom for weddings, nothing otherwise */
export function defaultCoupleLabels(category?: string): Record<CoupleSide, string> {
    return category === "Wedding" ? { left: "The Bride", right: "The Groom" } : { left: "", right: "" };
}

const SOCIAL_HOSTS: Readonly<Record<SocialNetwork, readonly string[]>> = {
    instagram: ["instagram.com"],
    facebook: ["facebook.com", "fb.com"],
    x: ["x.com", "twitter.com"],
};
const SOCIAL_PROFILE: Readonly<Record<SocialNetwork, string>> = {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    x: "https://x.com/",
};
// Usernames as each site allows them
const SOCIAL_USERNAME: Readonly<Record<SocialNetwork, RegExp>> = {
    instagram: /^[A-Za-z0-9._]{1,30}$/,
    facebook: /^[A-Za-z0-9.]{5,50}$/,
    x: /^[A-Za-z0-9_]{1,15}$/,
};
// "https://", then the site, then a path; no "user@" before the site, no spaces
const LINK = /^(?:https?:\/\/)?([A-Za-z0-9.-]+)(\/[\w.~\-/%?=&+]*)?(?:#.*)?$/i;

/** A profile link or @username for this network as a full https link to that network; null when it isn't one.
 *  Plain parsing (no URL class) so the app's engine reads it the same way. */
export function socialLinkUrl(network: SocialNetwork, text: string | undefined): string | null {
    const value = (text || "").trim();
    if (!value || value.length > COUPLE_LIMITS.link) return null;
    const firstPart = value.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();
    const siteOf = (host: string) => host.replace(/^(?:www|m|mobile)\./, "");
    const looksLikeLink = /^https?:\/\//i.test(value) || Object.values(SOCIAL_HOSTS).some((hosts) => hosts.includes(siteOf(firstPart)));
    if (!looksLikeLink) {
        const username = value.replace(/^@/, "");
        return SOCIAL_USERNAME[network].test(username) ? SOCIAL_PROFILE[network] + username : null;
    }
    const match = LINK.exec(value);
    if (!match) return null;
    const host = match[1].toLowerCase();
    const path = match[2] || "";
    // The site itself isn't a profile
    if (!SOCIAL_HOSTS[network].includes(siteOf(host)) || !/[^/]/.test(path)) return null;
    return `https://${host}${path}`;
}

const text = (value: unknown, limit: number) => (typeof value === "string" ? value.trim().slice(0, limit) : "");

/** One side as guests see it: trimmed and cut to the limits, with only working links; null when it has no name and
 *  nothing else (a label alone isn't content) */
export function cleanCouplePerson(person: Partial<CouplePerson> | undefined): CouplePerson | null {
    if (!person || typeof person !== "object") return null;
    const links: CouplePerson["links"] = {};
    const rawLinks = (person.links && typeof person.links === "object" ? person.links : {}) as Record<string, unknown>;
    SOCIAL_NETWORKS.forEach((network) => {
        const url = socialLinkUrl(network, typeof rawLinks[network] === "string" ? rawLinks[network] as string : "");
        if (url) links[network] = url;
    });
    const cleaned: CouplePerson = {
        label: text(person.label, COUPLE_LIMITS.label),
        name: text(person.name, COUPLE_LIMITS.name),
        about: text(person.about, COUPLE_LIMITS.about),
        links,
    };
    return cleaned.name || cleaned.about || Object.keys(links).length > 0 ? cleaned : null;
}

/** The couple as it is saved: each side cleaned, empty sides left out; null when both are empty */
export function cleanCouple(block: CoupleBlock | undefined): CoupleBlock | null {
    const cleaned: CoupleBlock = {};
    COUPLE_SIDES.forEach((side) => {
        const person = cleanCouplePerson(block?.[side]);
        if (person) cleaned[side] = person;
    });
    return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/** A block as it is saved; null when nothing is left in it (the block is then removed) */
export function cleanThemeContentBlock<B extends ThemeContentBlock>(block: B, value: unknown): ThemeContent[B] | null {
    switch (block) {
        case "couple": return cleanCouple(value as CoupleBlock | undefined) as ThemeContent[B] | null;
        default: return null;
    }
}

const THEME_CONTENT_BLOCKS: readonly ThemeContentBlock[] = ["couple"];

/** theme_content as read from the database (or any stored copy), keeping only the blocks this code knows, cleaned */
export function readThemeContent(value: unknown): ThemeContent {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const content: ThemeContent = {};
    THEME_CONTENT_BLOCKS.forEach((block) => {
        const cleaned = cleanThemeContentBlock(block, (value as Record<string, unknown>)[block]);
        if (cleaned) content[block] = cleaned;
    });
    return content;
}

/** The sides guests see: only a side with a name shows, and a link only when it has one */
export function shownCouple(block: CoupleBlock | undefined): Partial<Record<CoupleSide, CouplePerson>> {
    const shown: Partial<Record<CoupleSide, CouplePerson>> = {};
    COUPLE_SIDES.forEach((side) => {
        const person = cleanCouplePerson(block?.[side]);
        if (person?.name) shown[side] = person;
    });
    return shown;
}

export function emptyCouplePerson(label = ""): CouplePerson {
    return { label, name: "", about: "", links: {} };
}

/** Both sides as the edit panel shows them: the saved side, or an empty one with the default label */
export function editableCouple(block: CoupleBlock | undefined, category?: string): Record<CoupleSide, CouplePerson> {
    const labels = defaultCoupleLabels(category);
    const side = (key: CoupleSide): CouplePerson => {
        const person = block?.[key];
        if (!person) return emptyCouplePerson(labels[key]);
        // Always the same key order, so two copies compare as equal text
        return { label: person.label ?? "", name: person.name ?? "", about: person.about ?? "", links: { ...person.links } };
    };
    return { left: side("left"), right: side("right") };
}

/** Same content, as typed (a space typed at the end is a change, so the input keeps it) */
export function sameCouple(a: CoupleBlock, b: CoupleBlock): boolean {
    const stable = (block: CoupleBlock) => JSON.stringify(COUPLE_SIDES.map((side) => {
        const person = block[side];
        return person ? [person.label, person.name, person.about, SOCIAL_NETWORKS.map((network) => person.links[network] || "")] : null;
    }));
    return stable(a) === stable(b);
}
