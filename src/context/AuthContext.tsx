import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface AuthContextType {
  staff: Staff | null;
  loading: boolean;
  loginStaff: (name: string, pin: string) => Promise<{ error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(false);

  // Restore staff from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('creamello_staff');
    if (stored) {
      try {
        setStaff(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const loginStaff = async (name: string, pin: string) => {
    setLoading(true);
    try {
      // Get all staff and filter manually instead of using URL parameters
      const { data, error } = await supabase
        .from('staff')
        .select('*');
      
      if (error) throw error;
      
      // Find the matching staff member
      const matchedStaff = data?.find(
        (staff) => staff.name.toLowerCase() === name.toLowerCase() && staff.pin === pin
      );
      
      if (!matchedStaff) {
        setLoading(false);
        return { error: 'Invalid name or PIN' };
      }
      
      const staffObj = { 
        id: matchedStaff.id, 
        name: matchedStaff.name, 
        role: matchedStaff.role 
      };
      
      setStaff(staffObj);
      localStorage.setItem('creamello_staff', JSON.stringify(staffObj));
      setLoading(false);
      return {};
    } catch (err: any) {
      console.error('Login error:', err);
      setLoading(false);
      return { error: 'An error occurred during login. Please try again.' };
    }
  };

  const logout = () => {
    setStaff(null);
    localStorage.removeItem('creamello_staff');
  };

  return (
    <AuthContext.Provider value={{ staff, loading, loginStaff, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}; 