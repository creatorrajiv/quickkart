import { useAuth } from '../context/AuthProvider';

// Convenience hook — returns the full profile row and derived role flags.
export function useProfile() {
  const { profile, loading } = useAuth();
  return {
    profile,
    loading,
    isAdmin:    profile?.role === 'admin',
    isAgent:    profile?.role === 'agent',
    isCustomer: profile?.role === 'customer',
  };
}
