import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, MidnightColors } from '../constants/theme';
import { resolveTheme, type ThemeChoice } from '../../../shared/themes/themeChoice';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colors: typeof MidnightColors;
  isDark: boolean;
  /** What the person picked in Settings > Appearance; 'system' follows the phone */
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
}

// Light or dark look (todo #1), the same choice as the website's Appearance setting, saved on this phone
const THEME_CHOICE_KEY = '@evebash_theme_choice';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Starts on the phone's light/dark setting; Settings > Appearance can pick Light or Dark instead.
 * Guest event themes don't use this: they read the phone's setting themselves (useColorScheme in
 * app/events/[id].tsx) and sit inside a DarkThemeScope, so their look never changes with this choice.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_CHOICE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') setChoiceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    const save = next === 'system' ? AsyncStorage.removeItem(THEME_CHOICE_KEY) : AsyncStorage.setItem(THEME_CHOICE_KEY, next);
    save.catch(() => undefined);
  }, []);

  const theme = resolveTheme(choice, deviceScheme === 'light');
  const value = useMemo<ThemeContextType>(() => ({
    theme,
    setTheme: setChoice,
    colors: theme === 'light' ? LightColors : MidnightColors,
    isDark: theme === 'dark',
    choice,
    setChoice,
  }), [theme, choice, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Keeps its screens on the dark look whatever the Appearance choice: login, guest galleries, Vault, business pages.
 * With enabled={false} it passes the chosen look through, so toggling it doesn't remount what's inside.
 */
export function DarkThemeScope({ enabled = true, children }: { enabled?: boolean; children: React.ReactNode }) {
  const parent = useAppTheme();
  const value = useMemo<ThemeContextType>(
    () => (enabled ? { ...parent, theme: 'dark', colors: MidnightColors, isDark: true } : parent),
    [enabled, parent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Outside the provider (the root error page, the app-open animation) everything draws in the dark look
const OUTSIDE_PROVIDER: ThemeContextType = {
  theme: 'dark',
  setTheme: () => undefined,
  colors: MidnightColors,
  isDark: true,
  choice: 'system',
  setChoice: () => undefined,
};

export function useAppTheme() {
  return useContext(ThemeContext) ?? OUTSIDE_PROVIDER;
}

export type StatusBarLook = 'light' | 'dark';

/**
 * Lets a screen whose top changes as it scrolls (the host's event screen: cover photo, then page) choose the status
 * bar style. The root layout draws the one status bar; null hands it back. Set it only while the screen is focused.
 */
export const StatusBarOverrideContext = createContext<(look: StatusBarLook | null) => void>(() => undefined);

export function useStatusBarOverride() {
  return useContext(StatusBarOverrideContext);
}
