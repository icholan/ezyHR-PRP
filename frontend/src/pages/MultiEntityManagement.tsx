import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Users,
    Link as LinkIcon,
    Search,
    Building2,
    Plus,
    ChevronRight,
    UserPlus,
    Loader2,
    X,
    Filter
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/Common/SearchableSelect';
import { useAuthStore } from '../store/useAuthStore';

interface Person {
    id: string;
    full_name: string;
    nric_fin_last_4: string;
    nationality?: string;
}

interface Employment {
    id: string;
    entity_name: string;
    job_title: string;
    employee_code: string;
    is_active: boolean;
    citizenship_type?: string;
    pr_year?: number;
    work_pass_type?: string;
    work_pass_no?: string;
    work_pass_expiry?: string;
}

const MultiEntityManagement = () => {
    const navigate = useNavigate();
    const { setEntity } = useAuthStore();
    const [persons, setPersons] = useState<Person[]>([]);
    const [entities, setEntities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [personEmployments, setPersonEmployments] = useState<Employment[]>([]);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

    // Linking Modal States
    const [targetEntityId, setTargetEntityId] = useState('');
    const [loadingEmployments, setLoadingEmployments] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [personsRes, entitiesRes] = await Promise.all([
                api.get('/api/v1/employees/persons'),
                api.get('/api/v1/entities')
            ]);
            setPersons(personsRes.data);
            setEntities(entitiesRes.data);
        } catch (error) {
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const fetchPersonDetails = async (person: Person) => {
        try {
            setLoadingEmployments(true);
            setSelectedPerson(person);
            const res = await api.get(`/api/v1/employees/persons/${person.id}/employments`);
            setPersonEmployments(res.data);
        } catch (error) {
            toast.error("Failed to fetch employments");
        } finally {
            setLoadingEmployments(false);
        }
    };

    const handleLinkToEntity = () => {
        if (!selectedPerson || !targetEntityId) {
            toast.error("Please select a target entity");
            return;
        }

        // Update global entity so AddEmployee loads correct master data
        setEntity(targetEntityId);

        // Find the most recent or active employment to copy work pass details from
        const lastEmployment = personEmployments[0];

        navigate('/employees/add', {
            state: {
                linkPersonId: selectedPerson.id,
                nricToLink: selectedPerson.nric_fin_last_4,
                targetEntityId: targetEntityId,
                prefillDetails: lastEmployment ? {
                    citizenship_type: lastEmployment.citizenship_type,
                    pr_year: lastEmployment.pr_year,
                    work_pass_type: lastEmployment.work_pass_type,
                    work_pass_no: lastEmployment.work_pass_no,
                    work_pass_expiry: lastEmployment.work_pass_expiry,
                    employee_code: lastEmployment.employee_code
                } : null
            }
        });
        setIsLinkModalOpen(false);
    };

    const openLinkModal = () => {
        if (!selectedPerson) return;
        setTargetEntityId('');
        setIsLinkModalOpen(true);
    };

    const filteredPersons = persons.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                        Multi-Entity Management
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Link existing profiles across different companies and branches.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Persons List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col h-[700px]">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary-600" />
                                    Profiles ({persons.length})
                                </h2>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto nice-scrollbar p-2">
                            {loading ? (
                                <div className="flex justify-center p-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                </div>
                            ) : filteredPersons.map(person => (
                                <button
                                    key={person.id}
                                    onClick={() => fetchPersonDetails(person)}
                                    className={clsx(
                                        "w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between group",
                                        selectedPerson?.id === person.id
                                            ? "bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500/20"
                                            : "hover:bg-gray-50 dark:hover:bg-gray-800"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors",
                                            selectedPerson?.id === person.id ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover:bg-white dark:group-hover:bg-gray-700"
                                        )}>
                                            {person.full_name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{person.full_name}</p>
                                            <p className="text-xs text-gray-500">{person.nationality || 'Singapore Citizen'}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className={clsx(
                                        "w-4 h-4 transition-all",
                                        selectedPerson?.id === person.id ? "text-primary-600 translate-x-0" : "text-gray-300 -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                                    )} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Person Detail & Employments */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedPerson ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Profile Card */}
                            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 bg-primary-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-primary-500/20">
                                            {selectedPerson.full_name[0]}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedPerson.full_name}</h2>
                                            <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <Filter className="w-3.5 h-3.5" />
                                                    NRIC: {selectedPerson.nric_fin_last_4}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                <span>{selectedPerson.nationality}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={openLinkModal}
                                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-primary-500/30 hover:-translate-y-0.5"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Add to Another Entity
                                    </button>
                                </div>
                            </div>

                            {/* Employments List */}
                            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                                    <h3 className="font-bold flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-primary-600" />
                                        Current Employments
                                    </h3>
                                </div>

                                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {loadingEmployments ? (
                                        <div className="p-10 flex justify-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                                        </div>
                                    ) : personEmployments.length > 0 ? (
                                        personEmployments.map(emp => (
                                            <div key={emp.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-primary-600">
                                                        <Building2 className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-gray-100">{emp.entity_name}</p>
                                                        <p className="text-xs text-gray-500">{emp.job_title} • {emp.employee_code}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={clsx(
                                                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                        emp.is_active ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                                    )}>
                                                        {emp.is_active ? "Active" : "Terminated"}
                                                    </span>
                                                    <button
                                                        onClick={() => navigate(`/employees/${emp.id}`)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-400 hover:text-primary-600"
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-20 text-center text-gray-500">
                                            No employment records found for this person.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-800/20 rounded-[40px] border-2 border-dashed border-gray-100 dark:border-gray-800 p-20 text-center">
                            <div className="w-20 h-20 bg-white dark:bg-gray-900 rounded-3xl flex items-center justify-center text-gray-200 dark:text-gray-700 shadow-sm mb-6">
                                <Users className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Select a profile</h3>
                            <p className="text-gray-500 max-w-xs mt-2">
                                Select a person from the list to view their linked entities and add them to new ones.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Link Confirmation Modal */}
            {isLinkModalOpen && selectedPerson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-900 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <LinkIcon className="w-6 h-6 text-primary-600" />
                                    Link to Another Entity
                                </h3>
                                <button
                                    onClick={() => setIsLinkModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-900/30">
                                <p className="text-sm text-primary-900 dark:text-primary-100 leading-relaxed">
                                    You are about to link **{selectedPerson.full_name}** to a new entity.
                                    {personEmployments.length > 0 && (
                                        <>
                                            {" "}Current primary record is with **{personEmployments[0].entity_name}**.
                                        </>
                                    )}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Select Target Entity</label>
                                    <SearchableSelect
                                        options={entities
                                            .filter(ent => !personEmployments.some(emp => emp.entity_name === ent.name))
                                            .map(ent => ({ id: ent.id, label: ent.name }))
                                        }
                                        value={targetEntityId}
                                        onChange={(val) => setTargetEntityId(val)}
                                        placeholder="Choose an entity..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <button
                                    onClick={() => setIsLinkModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleLinkToEntity}
                                    disabled={!targetEntityId}
                                    className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-lg shadow-primary-500/30"
                                >
                                    Confirm Link
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiEntityManagement;
