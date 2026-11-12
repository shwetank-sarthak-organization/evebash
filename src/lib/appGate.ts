// Phones and tablets get a "download the app" screen instead of the website, except on these pages.
// Off unless NEXT_PUBLIC_MOBILE_APP_GATE=true at build time.
export const APP_GATE_ENABLED = process.env.NEXT_PUBLIC_MOBILE_APP_GATE === "true";

// Store pages, empty until the app is published; read at build time
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "";
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";

// Login and plans, plus what the stores, Razorpay and password emails need to open on a phone
export const APP_GATE_OPEN_PATHS = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/profile",
    "/pricing",
    "/contact-us",
    "/privacy-policy",
    "/terms-and-conditions",
    "/cancellation-refund-policy",
    "/shipping-delivery-policy",
    "/digital-service-delivery-policy",
    "/delete-account",
];

/**
 * True when this visitor should see the download screen. Self-contained (no outside references)
 * because its source is also inlined into <head> to decide before the first paint.
 */
export function shouldShowAppGate(userAgent: string, maxTouchPoints: number, pathname: string, openPaths: string[]): boolean {
    // Search engines and page checkers crawl as phones; they must still see the website
    if (/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(userAgent)) return false;
    // iPadOS Safari reports itself as a Mac, so a touch screen tells them apart
    const isPhoneOrTablet =
        /Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
    if (!isPhoneOrTablet) return false;
    for (let i = 0; i < openPaths.length; i++) {
        if (pathname === openPaths[i] || pathname.indexOf(openPaths[i] + "/") === 0) return false;
    }
    return true;
}

export const APP_GATE_ATTRIBUTE = "data-app-gate";

// Runs in <head> before the page paints, so phones never see the website flash first
export const appGateHeadScript = `try{if((${shouldShowAppGate.toString()})(navigator.userAgent,navigator.maxTouchPoints||0,location.pathname,${JSON.stringify(
    APP_GATE_OPEN_PATHS,
)}))document.documentElement.setAttribute("${APP_GATE_ATTRIBUTE}","")}catch(e){}`;
