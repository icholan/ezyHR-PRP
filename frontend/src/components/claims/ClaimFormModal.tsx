import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Receipt, Calendar, FileText, Camera, AlertCircle, Loader2, CheckCircle2, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface ClaimFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    entityId: string;
    onBehalfOf?: string; // employmentId
    employeeName?: string;
}

interface Category {
    id: string;
    name: string;
}

const ClaimFormModal: React.FC<ClaimFormModalProps> = ({ isOpen, onClose, onSuccess, entityId, onBehalfOf, employeeName }) => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    
    // Form state
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [claimDate, setClaimDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryId, setCategoryId] = useState('');
    const [description, setDescription] = useState('');
    const [receipts, setReceipts] = useState<File[]>([]);
    const [previews, setPreviews] = useState<{ id: string, url: string, name: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            setCategoriesLoading(true);
            const res = await api.get('/api/v1/claims/categories', { params: { entity_id: entityId } });
            setCategories(res.data);
            if (res.data.length > 0) setCategoryId(res.data[0].id);
        } catch (error) {
            console.error('Failed to fetch categories', error);
        } finally {
            setCategoriesLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            const newReceipts = [...receipts, ...files];
            setReceipts(newReceipts);

            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviews(prev => [
                        ...prev, 
                        { id: Math.random().toString(36).substr(2, 9), url: reader.result as string, name: file.name }
                    ]);
                };
                reader.readAsDataURL(file);
            });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (id: string, index: number) => {
        setReceipts(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter(p => p.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('title', title);
            formData.append('amount', amount);
            formData.append('claim_date', claimDate);
            formData.append('category_id', categoryId);
            formData.append('entity_id', entityId);
            formData.append('description', description);
            
            if (onBehalfOf) {
                formData.append('on_behalf_of', onBehalfOf);
            }
            
            receipts.forEach(file => {
                formData.append('receipts', file);
            });

            await api.post('/api/v1/claims', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Claim submitted successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Submission failed', error);
            toast.error('Failed to submit claim');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
                    >
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-200 dark:shadow-primary-900/30 cursor-default">
                                    <Receipt className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-dark-950 dark:text-gray-50">
                                        {employeeName ? `Submit Claim for ${employeeName}` : 'New Claim Submission'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        {employeeName ? `Filing a claim on behalf of ${employeeName}.` : 'Please provide accurate details and attach your receipts.'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:text-rose-500 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Title</label>
                                    <div className="relative">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            required
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            className="input-field pl-11"
                                            placeholder="e.g. Client Dinner"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Category</label>
                                    <select
                                        required
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                        className="input-field h-[46px]"
                                    >
                                        {categoriesLoading ? (
                                            <option>Loading categories...</option>
                                        ) : (
                                            categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Amount</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            className="input-field pl-11"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Expense Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type="date"
                                            required
                                            value={claimDate}
                                            onChange={e => setClaimDate(e.target.value)}
                                            className="input-field pl-11"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="input-field min-h-[100px] py-4"
                                    placeholder="Briefly explain the expense..."
                                />
                            </div>

                            {/* Receipt Upload */}
                            <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                                <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">Receipt Attachments</label>
                                
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[32px] cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:border-primary-300 transition-all group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 text-gray-400 group-hover:text-primary-600 rounded-2xl flex items-center justify-center mb-2 transition-colors">
                                            <Camera className="w-5 h-5" />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-bold text-primary-600">Add more files</span> or drag and drop</p>
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        className="hidden" 
                                        multiple
                                        accept="image/*,application/pdf" 
                                        onChange={handleFileChange} 
                                    />
                                </label>

                                {previews.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                                        {previews.map((file, index) => (
                                            <div key={file.id} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-sm group">
                                                {file.url.startsWith('data:application/pdf') ? (
                                                    <div className="w-full h-full bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center p-4">
                                                        <FileText className="w-8 h-8 text-primary-500 mb-2" />
                                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 text-center line-clamp-2">{file.name}</span>
                                                    </div>
                                                ) : (
                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={() => removeFile(file.id, index)}
                                                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform opacity-0 group-hover:opacity-100"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-[8px] font-bold text-white truncate">{file.name}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="px-8 py-6 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !title || !amount || !categoryId}
                                className="px-8 py-3.5 bg-primary-600 text-white font-extrabold rounded-2xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-primary-200 dark:shadow-primary-900/30 transition-all flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Submit for Review
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ClaimFormModal;
