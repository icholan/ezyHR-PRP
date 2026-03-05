import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../store/useThemeStore';
import { clsx } from 'clsx';

const modes = [
    { key: 'light' as const, icon: Sun, label: 'Light' },
    { key: 'dark' as const, icon: Moon, label: 'Dark' },
    { key: 'auto' as const, icon: Monitor, label: 'Auto' },
] as const;

const ThemeToggle = () => {
    const { mode, setMode } = useThemeStore();

    return (
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5">
            {modes.map(({ key, icon: Icon, label }) => (
                <button
                    key={key}
                    onClick={() => setMode(key)}
                    title={label}
                    className={clsx(
                        "p-2 rounded-lg transition-all duration-200",
                        mode === key
                            ? "bg-white dark:bg-gray-700 text-primary-600 shadow-sm"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    )}
                >
                    <Icon className="w-4 h-4" />
                </button>
            ))}
        </div>
    );
};

export default ThemeToggle;
