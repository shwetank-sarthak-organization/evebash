"use client";

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
    isSiteNoirPath,
    resolveSiteTheme,
    SITE_BAR_DARK,
    SITE_BAR_LIGHT,
    SITE_NOIR_ATTRIBUTE,
    SITE_NOIR_PATHS,
    SITE_THEME_ATTRIBUTE,
    SITE_THEME_KEY,
    type SiteTheme,
    type SiteThemeChoice,
} from "@/lib/siteTheme";

interface ThemeContextType {
    /** What the visitor picked; "system" follows the device */
    choice: SiteThemeChoice;
    /** The look showing now */
    theme: SiteTheme;
    setChoice: (choice: SiteThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// The theme lives on <html> (set first by siteThemeHeadScript) and the choice in localStorage; this keeps
// React in step with both.
const listeners = new Set<() => void>();
const lightQuery = "(prefers-color-scheme: light)";

function readChoice(): SiteThemeChoice {
    try {
        const saved = localStorage.getItem(SITE_THEME_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "system";
}

function applyChoice(choice: SiteThemeChoice) {
    const theme = resolveSiteTheme(choice, window.matchMedia(lightQuery).matches);
    document.documentElement.setAttribute(SITE_THEME_ATTRIBUTE, theme);
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const media = window.matchMedia(lightQuery);
    // The device switched light/dark, or another tab saved a choice
    const onDeviceChange = () => {
        if (readChoice() === "system") applyChoice("system");
    };
    const onStorage = (event: StorageEvent) => {
        if (event.key === SITE_THEME_KEY) applyChoice(readChoice());
    };
    media.addEventListener("change", onDeviceChange);
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        media.removeEventListener("change", onDeviceChange);
        window.removeEventListener("storage", onStorage);
    };
}

const getSnapshot = () => `${readChoice()}:${document.documentElement.getAttribute(SITE_THEME_ATTRIBUTE) ?? "dark"}`;
const getServerSnapshot = () => "system:dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [choice, theme] = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).split(":") as [SiteThemeChoice, SiteTheme];

    useEffect(() => {
        localStorage.removeItem("app_theme");
        document.documentElement.classList.add("theme-dark");
        document.documentElement.classList.remove("theme-light");
    }, []);

    // Pages that stay dark: set before the new page paints, so it never shows light for a frame
    useLayoutEffect(() => {
        document.documentElement.toggleAttribute(SITE_NOIR_ATTRIBUTE, isSiteNoirPath(pathname, SITE_NOIR_PATHS));
    }, [pathname]);

    // The phone browser's bar matches the page
    useEffect(() => {
        const light = theme === "light" && !isSiteNoirPath(pathname, SITE_NOIR_PATHS);
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", light ? SITE_BAR_LIGHT : SITE_BAR_DARK));
    }, [theme, pathname]);

    const setChoice = useCallback((next: SiteThemeChoice) => {
        try {
            if (next === "system") localStorage.removeItem(SITE_THEME_KEY);
            else localStorage.setItem(SITE_THEME_KEY, next);
        } catch {}
        applyChoice(next);
    }, []);

    return (
        <ThemeContext.Provider value={{ choice, theme, setChoice }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
