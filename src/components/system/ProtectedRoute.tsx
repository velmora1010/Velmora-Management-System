import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useRBAC } from '../../hooks/useRBAC';
import type { AppModule } from '../../types/rbac';

interface ProtectedRouteProps {
  requiredModule?: AppModule;
}

export const ProtectedRoute = ({ requiredModule }: ProtectedRouteProps) => {
  const { user, isAuthLoading } = useAuth();
  const { canView, isLoading: isRbacLoading } = useRBAC();
  const location = useLocation();

  if (isAuthLoading || isRbacLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Module level permission checking
  if (requiredModule && !canView(requiredModule)) {
    return <Navigate to="/" replace />;
  }

  // Authorized
  return <Outlet />;
};
