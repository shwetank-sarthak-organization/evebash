// Royal Emerald shows "Name & Name" titles as a couple. Hosts write the joiner in different ways, so "&", "+",
// and the whole words "and" / "weds" (any letter case) all count. Each side may be at most 3 words, so titles
// like "Sharma Family Get Together and Dinner Night" stay a single title.
const COUPLE_JOINER = /\s*[&+]\s*|\s+(?:and|weds)\s+/gi;
const MAX_WORDS_PER_NAME = 3;

/** "Asha and Raj" -> ["Asha", "Raj"]; any title that isn't two short names joined once -> null */
export function splitCoupleNames(title: string): [string, string] | null {
    const parts = title.trim().split(COUPLE_JOINER).map((part) => part.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const tooLong = parts.some((part) => part.split(/\s+/).length > MAX_WORDS_PER_NAME);
    return tooLong ? null : [parts[0], parts[1]];
}

/** The title with its joiner written as "&" ("Asha AND Raj" -> "Asha & Raj"); other titles unchanged */
export function displayCoupleTitle(title: string): string {
    const couple = splitCoupleNames(title);
    return couple ? `${couple[0]} & ${couple[1]}` : title;
}
