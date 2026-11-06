// Light or dark look (todo #1), on the website and in the app: people start on their device's setting, and
// Settings > Appearance (Light / Dark / Match device) saves a choice on that browser or phone.

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Self-contained (no outside references): the website inlines its source into <head>. */
export function resolveTheme(choice: string | null, prefersLight: boolean): ResolvedTheme {
    if (choice === "light" || choice === "dark") return choice;
    return prefersLight ? "light" : "dark";
}
