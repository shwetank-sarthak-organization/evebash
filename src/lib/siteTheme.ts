// Light or dark site look (todo #1). Visitors start on their device's setting; the navbar button and
// Settings > Appearance save a choice in this browser. Guest galleries, Vault and the embed pages never
// change: only the (main) layout's <body> (and the global 404) has the site-themed class the light colours apply to.

export type SiteThemeChoice = "light" | "dark" | "system";
export type SiteTheme = "light" | "dark";

export const SITE_THEME_KEY = "evebash_site_theme";
// On <html>: the look showing now, and whether this page keeps the dark look whatever the choice
export const SITE_THEME_ATTRIBUTE = "data-site-theme";
export const SITE_NOIR_ATTRIBUTE = "data-site-noir";

// Browser bar colours: the light page background, and the dark bar the site has always had
export const SITE_BAR_LIGHT = "#FBF8F3";
export const SITE_BAR_DARK = "#13191F";

// Pages that stay dark whatever the visitor picks: the login screens, left as they are
export const SITE_NOIR_PATHS = ["/login", "/forgot-password", "/reset-password"];

/** Self-contained (no outside references): its source is also inlined into <head>. */
export function isSiteNoirPath(pathname: string, noirPaths: string[]): boolean {
    for (let i = 0; i < noirPaths.length; i++) {
        if (pathname === noirPaths[i] || pathname.indexOf(noirPaths[i] + "/") === 0) return true;
    }
    return false;
}

/** Self-contained (no outside references): its source is also inlined into <head>. */
export function resolveSiteTheme(choice: string | null, prefersLight: boolean): SiteTheme {
    if (choice === "light" || choice === "dark") return choice;
    return prefersLight ? "light" : "dark";
}

// Runs in <head> before the page paints, so a light visitor never sees the dark page first
export const siteThemeHeadScript = `try{var c=null;try{c=localStorage.getItem("${SITE_THEME_KEY}")}catch(e){}var h=document.documentElement;h.setAttribute("${SITE_THEME_ATTRIBUTE}",(${resolveSiteTheme.toString()})(c,matchMedia("(prefers-color-scheme: light)").matches));if((${isSiteNoirPath.toString()})(location.pathname,${JSON.stringify(
    SITE_NOIR_PATHS,
)}))h.setAttribute("${SITE_NOIR_ATTRIBUTE}","")}catch(e){}`;
