import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, MapPin, Briefcase, Mail, Shield, Building2, Wallet, Contact } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const MyProfile = () => {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Editable personal states
    const [contactNumber, setContactNumber] = useState('');
    const [personalEmail, setPersonalEmail] = useState('');
    const [address, setAddress] = useState('');
    const [emergencyContactName, setEmergencyContactName] = useState('');
    const [emergencyContactRelation, setEmergencyContactRelation] = useState('');
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const resp = await api.get('/api/v1/employees/me');
            const data = resp.data;
            setProfile(data);
            
            // Populate editable fields
            if (data.person) {
                setContactNumber(data.person.mobile_number || data.person.contact_number || '');
                setPersonalEmail(data.person.personal_email || '');
                setAddress(data.person.address || '');
                setEmergencyContactName(data.person.emergency_contact_name || '');
                setEmergencyContactRelation(data.person.emergency_contact_relationship || '');
                setEmergencyContactNumber(data.person.emergency_contact_number || '');
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
            toast.error('Failed to load profile details.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                person: {
                    ...profile.person,
                    mobile_number: contactNumber,
                    contact_number: contactNumber,
                    personal_email: personalEmail,
                    address: address,
                    emergency_contact_name: emergencyContactName,
                    emergency_contact_relationship: emergencyContactRelation,
                    emergency_contact_number: emergencyContactNumber,
                }
            };
            
            const resp = await api.put('/api/v1/employees/me', payload);
            setProfile(resp.data);
            toast.success('Personal details updated successfully!');
        } catch (err) {
            console.error('Error updating profile:', err);
            toast.error('Failed to update personal details.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-12 text-gray-500">
                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No profile information available.</p>
            </div>
        );
    }

    const { person, employment, bank_account } = profile;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 flex items-center gap-6 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50">
                <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 text-3xl font-black shrink-0 shadow-inner">
                    {person.full_name?.charAt(0) || <User />}
                </div>
                <div>
                    <h1 className="text-3xl font-black font-premium text-dark-950 dark:text-gray-50">{person.full_name}</h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Briefcase className="w-4 h-4"/> {employment.job_title}</span>
                        <span className="flex items-center gap-1"><Shield className="w-4 h-4"/> {employment.employee_code}</span>
                        <span className="flex items-center gap-1"><Building2 className="w-4 h-4"/> {employment.department_name || 'No Dept'}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Information (Editable) */}
                <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-xl shadow-gray-200/20 dark:shadow-gray-900/50 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold font-premium text-dark-950 dark:text-gray-50 flex items-center gap-2">
                            <User className="w-5 h-5 text-primary-500"/> Personal & Contact Info
                        </h2>
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="btn btn-primary shadow-lg shadow-primary-500/20 text-sm py-2 px-6"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="input-field pl-10" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Personal Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="email" value={personalEmail} onChange={e => setPersonalEmail(e.target.value)} className="input-field pl-10" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Residential Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                <textarea value={address} onChange={e => setAddress(e.target.value)} className="input-field pl-10 py-3 min-h-[80px]" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                        <h3 className="text-md font-bold text-dark-950 dark:text-gray-50 flex items-center gap-2 mb-4">
                            <Contact className="w-4 h-4 text-rose-500" /> Emergency Contact
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                                <input type="text" value={emergencyContactName} onChange={e => setEmergencyContactName(e.target.value)} className="input-field" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Relationship</label>
                                    <input type="text" value={emergencyContactRelation} onChange={e => setEmergencyContactRelation(e.target.value)} className="input-field" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                                    <input type="text" value={emergencyContactNumber} onChange={e => setEmergencyContactNumber(e.target.value)} className="input-field" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Employment & Sensitive Information (Read-Only) */}
                <div className="space-y-6">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[32px] p-8 shadow-inner border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <h2 className="text-xl font-bold font-premium text-dark-900 dark:text-gray-100 flex items-center gap-2 mb-6">
                            <Briefcase className="w-5 h-5 text-gray-400"/> Employment Details
                        </h2>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700/50">
                                <span className="font-medium">Employment Type</span>
                                <span className="text-dark-950 dark:text-gray-200">{employment.employment_type}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700/50">
                                <span className="font-medium">Join Date</span>
                                <span className="text-dark-950 dark:text-gray-200">{employment.join_date}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700/50">
                                <span className="font-medium">Designation</span>
                                <span className="text-dark-950 dark:text-gray-200">{employment.designation || '-'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700/50">
                                <span className="font-medium">Work Location</span>
                                <span className="text-dark-950 dark:text-gray-200">{employment.work_location || '-'}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="font-medium">Notice Period</span>
                                <span className="text-dark-950 dark:text-gray-200">{employment.notice_period || '-'} months</span>
                            </div>
                        </div>
                        <p className="mt-4 text-xs italic text-gray-400">Please contact HR to update employment details.</p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[32px] p-8 shadow-inner border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <h2 className="text-xl font-bold font-premium text-dark-900 dark:text-gray-100 flex items-center gap-2 mb-6">
                            <Wallet className="w-5 h-5 text-gray-400"/> Bank & Statutory
                        </h2>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700/50">
                                <span className="font-medium">NRIC / FIN</span>
                                <span className="text-dark-950 dark:text-gray-200 font-mono bg-white dark:bg-gray-800 px-2 rounded">
                                    {person.nric_fin_last_4}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700/50">
                                <span className="font-medium">Bank Name</span>
                                <span className="text-dark-950 dark:text-gray-200">{bank_account?.bank_name || '-'}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="font-medium">Account Number</span>
                                <span className="text-dark-950 dark:text-gray-200 font-mono bg-white dark:bg-gray-800 px-2 rounded">
                                    {bank_account?.account_number_masked || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyProfile;
