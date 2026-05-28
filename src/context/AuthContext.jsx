/**
 * AuthContext — barrel export.
 *
 * Import from here anywhere in the app:
 *   import { useAuth, AuthProvider } from '@/context/AuthContext';
 *
 * Exposed values from useAuth():
 *   session        — raw Supabase Session | null
 *   profile        — profiles row | null
 *   loading        — true while initial session + profile are resolving
 *   isAdmin        — profile.role === 'admin'
 *   isAgent        — profile.role === 'agent'
 *   isCustomer     — profile.role === 'customer'
 *   signIn()       — { error }
 *   signUp()       — { error }
 *   signOut()      — void
 *   updateProfile()— { error }
 *   refreshProfile()— void
 */
export { AuthProvider, useAuth } from './AuthProvider';
