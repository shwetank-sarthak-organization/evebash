import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MidnightColors, LightColors } from '../constants/theme';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colors: typeof MidnightColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme_preference';

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('dark');

  useEffect(() => {
    let isMounted = true;

    async function loadTheme() {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && (storedTheme === 'light' || storedTheme === 'dark')) {
          setThemeState(storedTheme);
        }
      } catch (error) {
        console.error('Failed to load theme preference from AsyncStorage:', error);
      }
    }
    loadTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Failed to save theme preference to AsyncStorage:', error);
    }
  };

  const colors = theme === 'dark' ? MidnightColors : LightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
}
