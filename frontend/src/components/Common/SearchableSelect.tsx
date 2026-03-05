import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface Option {
    id: string;
    label: string;
    sublabel?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    label,
    required = false,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = useMemo(() => {
        return options.filter(opt =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (opt.sublabel && opt.sublabel.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
        if (!isOpen) {
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleSelect = (optionId: string) => {
        onChange(optionId);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && (
                <label className="block text-sm font-bold text-dark-950 dark:text-gray-50 mb-2">
                    {label} {required && <span className="text-rose-500">*</span>}
                </label>
            )}

            <div
                onClick={handleToggle}
                className={clsx(
                    "w-full h-[52px] px-4 rounded-[16px] border flex items-center justify-between cursor-pointer transition-all",
                    isOpen ? "border-purple-500 ring-4 ring-purple-500/10 bg-white dark:bg-gray-900" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm",
                    disabled && "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800"
                )}
            >
                <div className="flex-1 truncate">
                    {selectedOption ? (
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-dark-900 dark:text-gray-100">{selectedOption.label}</span>
                            {selectedOption.sublabel && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{selectedOption.sublabel}</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={clsx(
                    "w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200",
                    isOpen && "rotate-180"
                )} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-[100] w-full mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-gray-950/50 border border-gray-100 dark:border-gray-800 overflow-hidden"
                    >
                        <div className="p-2 border-b border-gray-50 dark:border-gray-800">
                            <div className="relative flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 group focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                                <Search className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="w-full bg-transparent border-none outline-none py-2 px-2 text-sm text-dark-900 dark:text-gray-100 placeholder:text-gray-400"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setIsOpen(false);
                                    }}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"
                                    >
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleSelect(option.id)}
                                        className={clsx(
                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left",
                                            value === option.id
                                                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                                                : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-dark-900 dark:hover:text-gray-100"
                                        )}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">{option.label}</span>
                                            {option.sublabel && (
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none mt-0.5">{option.sublabel}</span>
                                            )}
                                        </div>
                                        {value === option.id && <Check className="w-4 h-4" />}
                                    </button>
                                ))
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">No results found</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SearchableSelect;
