import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
}

/**
 * Applies the resolved theme (light or dark) to the <html> element.
 */
function applyTheme(mode: ThemeMode) {
    const root = document.documentElement;
    if (mode === 'dark') {
        root.classList.add('dark');
    } else if (mode === 'light') {
        root.classList.remove('dark');
    } else {
        // auto — follow OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
    }
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            mode: 'light' as ThemeMode,
            setMode: (mode: ThemeMode) => {
                applyTheme(mode);
                set({ mode });
            },
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    applyTheme(state.mode);
                }
            },
        }
    )
);

// Subscribe to ALL state changes and apply theme.
// This ensures the <html> class is always in sync,
// regardless of how or when the state changes.
useThemeStore.subscribe((state) => {
    applyTheme(state.mode);
});

// Listen for OS-level theme changes (for Auto mode)
if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const currentMode = useThemeStore.getState().mode;
        if (currentMode === 'auto') {
            applyTheme('auto');
        }
    });
}

// Apply immediately on module load (handles page refresh)
applyTheme(useThemeStore.getState().mode);
