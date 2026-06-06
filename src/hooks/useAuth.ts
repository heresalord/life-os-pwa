// Re-export from the shared context so all existing imports keep working.
// The auth state is now a singleton — fetchProfile runs once, not once per component.
export { useAuth } from '../contexts/AuthContext'
