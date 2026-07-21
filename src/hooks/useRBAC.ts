import { useContext } from 'react';
import { RBACContext } from '../contexts/RBACContext';

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
};
