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
  const [currentAttendanceRecord, setCurrentAttendanceRecord] = useState<string | null>(null);

  // Restore staff from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('razorbill_staff');
    const attendanceId = localStorage.getItem('razorbill_attendance_id');
    
    if (stored) {
      try {
        setStaff(JSON.parse(stored));
        if (attendanceId) {
          setCurrentAttendanceRecord(attendanceId);
        }
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
      
      // Create attendance record for login
      try {
        const now = new Date().toISOString();
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('staff_attendance')
          .insert([
            {
              staff_id: staffObj.id,
              login_time: now,
              logout_time: null
            }
          ])
          .select('id')
          .single();
          
        if (attendanceError) {
          console.error('Error creating attendance record:', attendanceError);
        } else if (attendanceData) {
          // Store the attendance record ID for logout
          setCurrentAttendanceRecord(attendanceData.id);
          localStorage.setItem('razorbill_attendance_id', attendanceData.id);
        }
      } catch (attendanceErr) {
        console.error('Error logging attendance:', attendanceErr);
      }
      
      setStaff(staffObj);
      localStorage.setItem('razorbill_staff', JSON.stringify(staffObj));
      setLoading(false);
      return {};
    } catch (err: any) {
      console.error('Login error:', err);
      setLoading(false);
      return { error: 'An error occurred during login. Please try again.' };
    }
  };

  const logout = async () => {
    // If we have an open attendance record, update it with logout time
    if (currentAttendanceRecord) {
      try {
        const now = new Date().toISOString();
        await supabase
          .from('staff_attendance')
          .update({ logout_time: now })
          .eq('id', currentAttendanceRecord);
          
        setCurrentAttendanceRecord(null);
        localStorage.removeItem('razorbill_attendance_id');
      } catch (err) {
        console.error('Error updating attendance record on logout:', err);
      }
    }
    
    setStaff(null);
    localStorage.removeItem('razorbill_staff');
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