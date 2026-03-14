import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    tenant_id: string;
    selected_entity_id: string | null;
    is_platform_admin: boolean;
    is_tenant_admin: boolean;
    setup_complete: boolean;
    display_name?: string;
    employment_id?: string;
    entity_access?: {
        entity_id: string;
        role_id: string;
        role_name?: string;
        permissions?: string[];
    }[];
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    setEntity: (entityId: string) => void;
    completeSetup: () => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            login: (user, token) => {
                localStorage.setItem('token', token);
                set({ user, token, isAuthenticated: true });
            },
            setEntity: (entityId) => {
                set((state) => ({
                    user: state.user ? { ...state.user, selected_entity_id: entityId } : null
                }));
            },
            completeSetup: () => {
                set((state) => ({
                    user: state.user ? { ...state.user, setup_complete: true } : null
                }));
            },
            logout: async () => {
                const currentToken = get().token;
                if (currentToken) {
                    try {
                        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/auth/logout`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${currentToken}`,
                                'Content-Type': 'application/json'
                            }
                        });
                    } catch (error) {
                        console.error('Logout API call failed:', error);
                    }
                }

                localStorage.removeItem('token');
                set({ user: null, token: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);
