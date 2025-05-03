import { createContext, useContext, useState, ReactNode } from 'react';
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

  const loginStaff = async (name: string, pin: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('name', name)
      .eq('pin', pin)
      .single();
    setLoading(false);
    if (error || !data) {
      return { error: 'Invalid name or PIN' };
    }
    setStaff({ id: data.id, name: data.name, role: data.role });
    return {};
  };

  const logout = () => {
    setStaff(null);
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