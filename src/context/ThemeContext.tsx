"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "royal" | "light";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("royal");

    useEffect(() => {
        // Load theme from localStorage on mount
        const storedTheme = localStorage.getItem("app_theme") as Theme;
        if (storedTheme === "light") {
            setThemeState("light");
            document.documentElement.classList.add("theme-light");
        } else {
            setThemeState("royal");
            document.documentElement.classList.remove("theme-light");
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem("app_theme", newTheme);
        if (newTheme === "light") {
            document.documentElement.classList.add("theme-light");
        } else {
            document.documentElement.classList.remove("theme-light");
        }
    };

    const toggleTheme = () => {
        setTheme(theme === "royal" ? "light" : "royal");
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
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
