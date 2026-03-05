import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface DatePickerProps {
    value: string;                          // YYYY-MM-DD
    onChange: (value: string) => void;
    label?: string;
    icon?: React.ElementType;
    placeholder?: string;
    required?: boolean;
    error?: string;
    className?: string;
    inputClassName?: string;
    align?: 'left' | 'right';              // Dropdown alignment
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type ViewMode = 'days' | 'months' | 'years';

const CALENDAR_WIDTH = 310;
const CALENDAR_HEIGHT = 340; // approximate

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    label,
    icon: Icon,
    placeholder = 'Select date',
    required,
    error,
    className,
    inputClassName,
    align = 'left',
}) => {
    const [open, setOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('days');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLDivElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);

    // Calendar state
    const parsed = value ? new Date(value + 'T00:00:00') : null;
    const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());

    // For year grid: the start of the current decade page
    const decadeStart = Math.floor(viewYear / 12) * 12;

    // Sync calendar view when value changes externally
    useEffect(() => {
        if (parsed) {
            setViewYear(parsed.getFullYear());
            setViewMonth(parsed.getMonth());
        }
    }, [value]);

    // Compute portal position from trigger rect
    const computePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        // Open upward if not enough space below
        const openUpward = spaceBelow < CALENDAR_HEIGHT + 16 && spaceAbove > CALENDAR_HEIGHT + 16;

        const top = openUpward
            ? rect.top + window.scrollY - CALENDAR_HEIGHT - 8
            : rect.bottom + window.scrollY + 8;

        let left: number;
        if (align === 'right') {
            left = rect.right + window.scrollX - CALENDAR_WIDTH;
        } else {
            left = rect.left + window.scrollX;
        }

        // Clamp to viewport
        left = Math.max(8, Math.min(left, window.innerWidth - CALENDAR_WIDTH - 8));

        setDropdownStyle({ top, left, width: CALENDAR_WIDTH });
    };

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
                calendarRef.current && !calendarRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
                setViewMode('days');
            }
        };
        if (open) {
            document.addEventListener('mousedown', handler);
            window.addEventListener('scroll', () => computePosition(), true);
        }
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', () => computePosition(), true);
        };
    }, [open]);

    // Recompute on open
    useEffect(() => {
        if (open) computePosition();
    }, [open]);

    // Build day grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevDaysCount = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; current: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDaysCount - i, current: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) for (let d = 1; d <= remaining; d++) cells.push({ day: d, current: false });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const selectDate = (day: number) => {
        const m = String(viewMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        onChange(`${viewYear}-${m}-${d}`);
        setOpen(false);
        setViewMode('days');
    };

    const selectMonth = (monthIdx: number) => {
        setViewMonth(monthIdx);
        setViewMode('days');
    };

    const selectYear = (year: number) => {
        setViewYear(year);
        setViewMode('months');
    };

    const displayValue = parsed
        ? `${parsed.getDate()} ${MONTHS[parsed.getMonth()]?.slice(0, 3)} ${parsed.getFullYear()}`
        : '';

    const IconComp = Icon ?? Calendar;

    const handlePrev = () => {
        if (viewMode === 'days') {
            if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
            else setViewMonth(m => m - 1);
        } else if (viewMode === 'months') {
            setViewYear(y => y - 1);
        } else {
            setViewYear(y => y - 12);
        }
    };

    const handleNext = () => {
        if (viewMode === 'days') {
            if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
            else setViewMonth(m => m + 1);
        } else if (viewMode === 'months') {
            setViewYear(y => y + 1);
        } else {
            setViewYear(y => y + 12);
        }
    };

    const headerTitle = viewMode === 'days'
        ? `${MONTHS[viewMonth]} ${viewYear}`
        : viewMode === 'months'
            ? `${viewYear}`
            : `${decadeStart} – ${decadeStart + 11}`;

    const handleHeaderClick = () => {
        if (viewMode === 'days') setViewMode('months');
        else if (viewMode === 'months') setViewMode('years');
    };

    const calendarDropdown = open ? ReactDOM.createPortal(
        <div
            ref={calendarRef}
            style={{ ...dropdownStyle, position: 'absolute', zIndex: 9999 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl shadow-gray-200/40 dark:shadow-black/40 p-4 animate-in fade-in slide-in-from-top-2 duration-200"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={handlePrev}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                    type="button"
                    onClick={handleHeaderClick}
                    disabled={viewMode === 'years'}
                    className={clsx(
                        "text-sm font-bold transition-colors px-2 py-1 rounded-lg",
                        viewMode !== 'years'
                            ? "text-gray-800 dark:text-gray-100 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer"
                            : "text-gray-800 dark:text-gray-100 cursor-default"
                    )}
                >
                    {headerTitle}
                </button>
                <button
                    type="button"
                    onClick={handleNext}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
            </div>

            {/* DAYS VIEW */}
            {viewMode === 'days' && (
                <>
                    <div className="grid grid-cols-7 mb-1">
                        {DAYS.map(d => (
                            <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {cells.map((c, i) => {
                            const dateStr = c.current
                                ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`
                                : '';
                            const isSelected = c.current && dateStr === value;
                            const isToday = c.current && dateStr === todayStr;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={!c.current}
                                    onClick={() => c.current && selectDate(c.day)}
                                    className={clsx(
                                        'w-9 h-9 mx-auto rounded-xl text-sm font-medium flex items-center justify-center transition-all duration-150',
                                        !c.current && 'text-gray-300 dark:text-gray-700 cursor-default',
                                        c.current && !isSelected && !isToday && 'text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300',
                                        isToday && !isSelected && 'text-purple-600 dark:text-purple-400 font-bold ring-1 ring-purple-200 dark:ring-purple-800',
                                        isSelected && 'bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/40 font-bold',
                                    )}
                                >
                                    {c.day}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* MONTHS VIEW */}
            {viewMode === 'months' && (
                <div className="grid grid-cols-3 gap-2">
                    {MONTHS_SHORT.map((m, i) => {
                        const isCurrent = i === viewMonth && viewYear === (parsed?.getFullYear() ?? -1);
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => selectMonth(i)}
                                className={clsx(
                                    'py-3 rounded-xl text-sm font-semibold transition-all duration-150',
                                    isCurrent
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/40'
                                        : 'text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300',
                                )}
                            >
                                {m}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* YEARS VIEW */}
            {viewMode === 'years' && (
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, i) => decadeStart + i).map(y => {
                        const isCurrent = y === (parsed?.getFullYear() ?? -1);
                        const isThisYear = y === today.getFullYear();
                        return (
                            <button
                                key={y}
                                type="button"
                                onClick={() => selectYear(y)}
                                className={clsx(
                                    'py-3 rounded-xl text-sm font-semibold transition-all duration-150',
                                    isCurrent
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/40'
                                        : isThisYear
                                            ? 'text-purple-600 dark:text-purple-400 font-bold ring-1 ring-purple-200 dark:ring-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                                            : 'text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-300',
                                )}
                            >
                                {y}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Today shortcut */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                <button
                    type="button"
                    onClick={() => {
                        setViewYear(today.getFullYear());
                        setViewMonth(today.getMonth());
                        setViewMode('days');
                        selectDate(today.getDate());
                    }}
                    className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                    Today
                </button>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className={clsx('relative', className)}>
            {label && (
                <label className="block text-sm font-bold text-dark-950 dark:text-gray-50 mb-2">
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>
            )}
            {/* Trigger */}
            <div
                ref={triggerRef}
                className={clsx(
                    'w-full h-[52px] pl-11 pr-4 rounded-[16px] border flex items-center cursor-pointer select-none transition-all',
                    open
                        ? 'border-purple-500 ring-4 ring-purple-500/10 bg-white dark:bg-gray-900'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm',
                    error && 'border-rose-400',
                    inputClassName,
                )}
                onClick={() => { setOpen(o => !o); setViewMode('days'); }}
            >
                <IconComp className="absolute left-4 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <span className={clsx('text-sm', !displayValue && 'text-gray-400 dark:text-gray-500', displayValue && 'font-semibold text-dark-900 dark:text-gray-100')}>
                    {displayValue || placeholder}
                </span>
            </div>

            {calendarDropdown}
        </div>
    );
};

export default DatePicker;
