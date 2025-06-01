import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Plus, Clock, Calendar, Settings as SettingsIcon, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, differenceInMinutes, addDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Receipt, { ReceiptTemplate, ReceiptOrder } from '@/components/Receipt';
import { printReceipt } from '@/utils/receiptPrinter';
// import { formatDate } from '../utils/dates'; // Not used - commented out

// Define StaffPermissions type locally
type StaffPermissions = {
  dashboard: boolean;
  orders: boolean;
  production: boolean;
  inventory: boolean;
  reports: boolean;
  settings: boolean;
};

// Helper function to get default permissions based on role
const getDefaultPermissions = (role: string): StaffPermissions => {
  switch (role) {
    case 'admin':
      return {
        dashboard: true,
        orders: true,
        production: true,
        inventory: true,
        reports: true,
        settings: true
      };
    case 'manager':
      return {
        dashboard: true,
        orders: true,
        production: true,
        inventory: true,
        reports: true,
        settings: false
      };
    default: // staff
      return {
        dashboard: false,
        orders: true,
        production: false,
        inventory: false,
        reports: false,
        settings: false
      };
  }
};

// Type for menu items
interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
}

// Type for staff attendance records
interface StaffAttendance {
  id: string;
  staff_id: string;
  staff_name?: string;
  login_time: string;
  logout_time: string | null;
  total_minutes?: number;
}

// List of menu categories
const MENU_CATEGORIES = [
  'Flavors',
  'Toppings',
  'Waffles & Pancakes',
  'Sundaes',
  'Milkshakes',
  'Juice',
];

const Settings = () => {
  const [shopName, setShopName] = useState('Creamello');
  const [email, setEmail] = useState('contact@creamello.com');
  const [currency, setCurrency] = useState('GHS');
  const [notifications, setNotifications] = useState({
    lowStock: true,
    expiryAlert: true,
    salesReport: true,
    productionReminders: false
  });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [theme, setTheme] = useState('light');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { staff: currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === 'admin';
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', pin: '', role: 'staff' });
  
  // Staff permissions management state
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedStaffForPermissions, setSelectedStaffForPermissions] = useState<any>(null);
  const [tempPermissions, setTempPermissions] = useState<StaffPermissions>({
    dashboard: false,
    orders: false,
    production: false,
    inventory: false,
    reports: false,
    settings: false,
  });
  
  // Staff attendance tracking
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendance[]>([]);
  const [dailyHours, setDailyHours] = useState<Record<string, any>>({});
  const [selectedWeek, setSelectedWeek] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  // Menu items state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);
  const [showEditMenuItem, setShowEditMenuItem] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);
  const [newMenuItem, setNewMenuItem] = useState<Partial<MenuItem>>({
    name: '',
    category: 'Flavors',
    price: 0,
    description: '',
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Business Operations settings
  const [businessHours, setBusinessHours] = useState({
    openTime: '11:00',
    closeTime: '23:00'
  });
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [autoCompleteMinutes, setAutoCompleteMinutes] = useState(15);
  const [taxRate, setTaxRate] = useState(0);
  const [receiptSettings, setReceiptSettings] = useState({
    autoPrint: false,
    showLogo: true,
    footerText: 'Thank you for visiting Creamello!'
  });

  // Receipt Template settings
  const [receiptTemplate, setReceiptTemplate] = useState({
    shopName: 'CREAMELLO',
    address: '123 Ice Cream Lane, Accra',
    phone: '055-123-4567',
    width: 48, // characters (58mm = 32, 80mm = 48)
    showHeader: true,
    showFooter: true,
    showQrCode: false,
    headerText: 'CASH RECEIPT',
    footerText: 'Thank you for your business!\nVisit us again soon!',
    customMessage: '',
    showOrderDetails: true,
    showStaffInfo: true,
    showDateTime: true,
    showTableInfo: true,
    showCustomerInfo: true,
    paperSize: '80mm', // '58mm' or '80mm'
    encoding: 'utf-8',
    cutType: 'full', // 'full', 'partial', 'none'
  });

  // System statistics state
  const [systemStats, setSystemStats] = useState({
    totalOrders: 0,
    isDbConnected: false
  });

  // Add branding state variables
  const [brandingSettings, setBrandingSettings] = useState({
    customShopName: 'Creamello', // For sidebar display
    logoUrl: '',
    primaryColor: '#8B5CF6', // Default purple
    useCustomLogo: false
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('*').limit(1).single();
      console.log('Fetched settings data:', data);
      console.log('Current branding_settings:', data?.branding_settings);
      
      if (data) {
        setSettingsId(data.id);
        setShopName(data.shop_name || '');
        setEmail(data.email || '');
        setCurrency(data.currency || 'GHS');
        setNotifications(data.notifications || {
          lowStock: true,
          expiryAlert: true,
          salesReport: true,
          productionReminders: false
        });
        setTheme(data.theme || 'light');
        setDateFormat(data.date_format || 'MM/DD/YYYY');
        setAutoRefresh(data.auto_refresh !== undefined ? data.auto_refresh : true);
        
        // Load branding settings - make sure to use existing values if they exist
        if (data.branding_settings) {
          setBrandingSettings(data.branding_settings);
        } else {
          // Only use defaults if no branding settings exist
          setBrandingSettings({
            customShopName: 'Creamello',
            logoUrl: '',
            primaryColor: '#8B5CF6',
            useCustomLogo: false
          });
        }
        
        // Load business operations settings
        setBusinessHours(data.business_hours || { openTime: '11:00', closeTime: '23:00' });
        setLowStockThreshold(data.low_stock_threshold || 10);
        setAutoCompleteMinutes(data.auto_complete_minutes || 15);
        setTaxRate(data.tax_rate || 0);
        setReceiptSettings(data.receipt_settings || {
          autoPrint: false,
          showLogo: true,
          footerText: 'Thank you for visiting Creamello!'
        });
        
        // Load receipt template settings
        setReceiptTemplate(data.receipt_template || {
          shopName: 'CREAMELLO',
          address: '123 Ice Cream Lane, Accra',
          phone: '055-123-4567',
          width: 48,
          showHeader: true,
          showFooter: true,
          showQrCode: false,
          headerText: 'CASH RECEIPT',
          footerText: 'Thank you for your business!\nVisit us again soon!',
          customMessage: '',
          showOrderDetails: true,
          showStaffInfo: true,
          showDateTime: true,
          showTableInfo: true,
          showCustomerInfo: true,
          paperSize: '80mm',
          encoding: 'utf-8',
          cutType: 'full',
        });
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('id, name, role, pin, permissions');
        setStaffList(data || []);
      };
      fetchStaff();
      
      // Fetch menu items
      const fetchMenuItems = async () => {
        const { data, error } = await supabase.from('menu_items').select('*');
        if (error) {
          toast({ title: 'Error loading menu items', description: error.message, variant: 'destructive' });
        } else {
          setMenuItems(data || []);
        }
      };
      fetchMenuItems();
      
      // Fetch staff attendance data
      fetchStaffAttendance();
      fetchSystemStats();
    }
  }, [isAdmin, selectedWeek]);
  
  // Function to fetch staff attendance data for the selected week
  const fetchStaffAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*, staff(name)')
        .order('login_time', { ascending: false });
        
      if (error) {
        console.error('Error fetching staff attendance:', error);
        return;
      }

      // Format the data with staff names
      const formattedData = (data || []).map(record => ({
        ...record,
        staff_name: record.staff?.name || 'Unknown',
        total_minutes: record.logout_time 
          ? differenceInMinutes(parseISO(record.logout_time), parseISO(record.login_time))
          : null
      }));

      setStaffAttendance(formattedData);
      
      // Calculate daily hours for the selected week
      calculateDailyHours(formattedData);
    } catch (err) {
      console.error('Error in fetchStaffAttendance:', err);
    }
  };

  // Function to calculate daily hours for the selected week
  const calculateDailyHours = (data: StaffAttendance[]) => {
    const hours: Record<string, any> = {};
    
    data.forEach(record => {
      if (!record.total_minutes) return;
      
      const day = format(new Date(record.login_time), 'yyyy-MM-dd');
      const staffId = record.staff_id;
      const staffName = record.staff_name;
      
      if (!hours[staffId]) {
        hours[staffId] = { 
          name: staffName,
          days: {},
          totalHours: 0 
        };
      }
      
      if (!hours[staffId].days[day]) {
        hours[staffId].days[day] = 0;
      }
      
      // Add hours worked for this record
      hours[staffId].days[day] += record.total_minutes / 60;
      hours[staffId].totalHours += record.total_minutes / 60;
    });
    
    setDailyHours(hours);
  };

  // Function to fetch system statistics
  const fetchSystemStats = async () => {
    try {
      // Test database connection
      const { error: connectionError } = await supabase.from('settings').select('id').limit(1);
      const isConnected = !connectionError;

      // Get total orders count
      const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      setSystemStats(prev => ({
        ...prev,
        totalOrders: ordersCount || 0,
        isDbConnected: isConnected
      }));
    } catch (err) {
      console.error('Error fetching system stats:', err);
      setSystemStats(prev => ({
        ...prev,
        isDbConnected: false
      }));
    }
  };

  const saveSettings = async (overrides = {}) => {
    const upsertData = {
      id: settingsId || undefined,
      shop_name: shopName,
      email,
      currency,
      notifications,
      theme,
      date_format: dateFormat,
      auto_refresh: autoRefresh,
      business_hours: businessHours,
      low_stock_threshold: lowStockThreshold,
      auto_complete_minutes: autoCompleteMinutes,
      tax_rate: taxRate,
      receipt_settings: receiptSettings,
      receipt_template: receiptTemplate,
      branding_settings: brandingSettings,
      ...overrides,
    };
    const { error } = await supabase.from('settings').upsert(upsertData, { onConflict: 'id' });
    return error;
  };

  const handleSaveNotifications = async () => {
    const error = await saveSettings();
    if (!error) {
      toast({
        title: 'Notification Preferences Updated',
        description: 'Your notification settings have been saved.'
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSaveSystem = async () => {
    // Validate branding settings
    if (!brandingSettings.customShopName.trim()) {
      toast({
        title: 'Missing Shop Name',
        description: 'Please enter a shop name for the sidebar.',
        variant: 'destructive'
      });
      return;
    }

    await saveSettings({
      theme,
      date_format: dateFormat,
      auto_refresh: autoRefresh,
      shop_name: shopName,
      email: email,
      currency: currency,
      branding_settings: brandingSettings, // Include branding settings
    });
    
    // Dispatch custom event to notify sidebar of changes
    window.dispatchEvent(new CustomEvent('brandingUpdated'));
    
    toast({ 
      title: 'System Settings Saved', 
      description: 'All system settings, shop information, and branding have been updated successfully.' 
    });
  };

  const handleSaveBusinessOperations = async () => {
    // Validate business hours
    if (businessHours.openTime >= businessHours.closeTime) {
      toast({
        title: 'Invalid Business Hours',
        description: 'Opening time must be before closing time.',
        variant: 'destructive'
      });
      return;
    }

    // Validate numeric inputs
    if (lowStockThreshold < 0 || autoCompleteMinutes < 0 || taxRate < 0) {
      toast({
        title: 'Invalid Values',
        description: 'Values cannot be negative.',
        variant: 'destructive'
      });
      return;
    }

    if (taxRate > 100) {
      toast({
        title: 'Invalid Tax Rate',
        description: 'Tax rate cannot exceed 100%.',
        variant: 'destructive'
      });
      return;
    }

    const error = await saveSettings();
    if (!error) {
      toast({
        title: 'Business Operations Updated',
        description: 'Your business operations settings have been saved.'
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSaveReceiptSettings = async () => {
    // Validate receipt template
    if (!receiptTemplate.shopName || !receiptTemplate.address || !receiptTemplate.phone) {
      toast({
        title: 'Missing Required Fields',
        description: 'Shop name, address, and phone are required.',
        variant: 'destructive'
      });
      return;
    }

    if (receiptTemplate.width < 20 || receiptTemplate.width > 80) {
      toast({
        title: 'Invalid Width',
        description: 'Receipt width must be between 20 and 80 characters.',
        variant: 'destructive'
      });
      return;
    }

    const error = await saveSettings();
    if (!error) {
      toast({
        title: 'Receipt Settings Updated',
        description: 'Your receipt template has been saved successfully.'
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleTestPrint = async () => {
    const testOrder: ReceiptOrder = {
      id: 'test-order',
      orderNumber: 'TEST-001',
      items: [
        {
          name: 'Vanilla Ice Cream',
          quantity: 2,
          price: 5.00,
          total: 10.00
        },
        {
          name: 'Chocolate Sauce',
          quantity: 1,
          price: 2.00,
          total: 2.00
        }
      ],
      subtotal: 12.00,
      tax: 0,
      total: 12.00,
      paymentMethod: 'Cash',
      amountPaid: 15.00,
      change: 3.00,
      customerName: 'Test Customer',
      tableNumber: '5',
      staffName: 'Test Staff',
      createdAt: new Date().toISOString()
    };

    try {
      const success = await printReceipt(receiptTemplate, testOrder, {
        autoCut: receiptTemplate.cutType !== 'none',
        openDrawer: false
      });

      if (success) {
        toast({
          title: 'Test Print Successful',
          description: 'Receipt sent to printer successfully.'
        });
      } else {
        toast({
          title: 'Print Failed',
          description: 'Could not print receipt. Check printer connection.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Print Error',
        description: 'An error occurred while printing.',
        variant: 'destructive'
      });
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.pin || !newStaff.role) {
      toast({ title: 'Missing Fields', description: 'Please fill all fields.', variant: 'destructive' });
      return;
    }
    
    // Store the original PIN for display in success message
    const displayPin = newStaff.pin;
    
    // Get default permissions for the role
    const defaultPermissions = getDefaultPermissions(newStaff.role);
    
    // In a production app, you would use a proper password hashing library
    // For now, we'll just store the PIN as-is, but mask it in the UI
    const { error } = await supabase.from('staff').insert([{ 
      name: newStaff.name, 
      pin: newStaff.pin, 
      role: newStaff.role,
      permissions: defaultPermissions
    }]);
    
    if (!error) {
      toast({ 
        title: 'Staff Added', 
        description: `${newStaff.name} added as ${newStaff.role} with PIN: ${displayPin}` 
      });
      setShowAddStaff(false);
      setNewStaff({ name: '', pin: '', role: 'staff' });
      // Refresh staff list
      const { data } = await supabase.from('staff').select('id, name, role, pin, permissions');
      setStaffList(data || []);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Open permissions dialog for a staff member
  const handleManagePermissions = (staff: any) => {
    setSelectedStaffForPermissions(staff);
    // Use existing permissions or default based on role
    const permissions = staff.permissions || getDefaultPermissions(staff.role);
    setTempPermissions(permissions);
    setShowPermissionsDialog(true);
  };

  // Save permissions for a staff member
  const handleSavePermissions = async () => {
    if (!selectedStaffForPermissions) return;

    const { error } = await supabase
      .from('staff')
      .update({ permissions: tempPermissions })
      .eq('id', selectedStaffForPermissions.id);

    if (!error) {
      toast({
        title: 'Permissions Updated',
        description: `${selectedStaffForPermissions.name}'s access permissions have been updated.`
      });
      setShowPermissionsDialog(false);
      setSelectedStaffForPermissions(null);

      // Refresh staff list
      const { data } = await supabase.from('staff').select('id, name, role, pin, permissions');
      setStaffList(data || []);
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  
  // Menu Item handlers
  const handleAddMenuItem = async () => {
    if (!newMenuItem.name || !newMenuItem.category || newMenuItem.price === undefined) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    
    // Create ID based on category and name
    const categoryPrefix = newMenuItem.category?.toLowerCase().split(' ')[0] || 'item';
    const id = `${categoryPrefix}-${newMenuItem.name?.toLowerCase().replace(/\s+/g, '')}`;
    
    const menuItem = {
      id,
      name: newMenuItem.name,
      category: newMenuItem.category,
      price: Number(newMenuItem.price),
      description: newMenuItem.description || null
    };
    
    const { error } = await supabase.from('menu_items').insert([menuItem]);
    
    if (!error) {
      toast({ title: 'Menu Item Added', description: `${menuItem.name} added to ${menuItem.category}.` });
      setShowAddMenuItem(false);
      setNewMenuItem({ name: '', category: 'Flavors', price: 0, description: '' });
      
      // Refresh menu items
      const { data } = await supabase.from('menu_items').select('*');
      setMenuItems(data || []);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleEditMenuItem = async () => {
    if (!currentMenuItem) return;
    
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: currentMenuItem.name,
        category: currentMenuItem.category,
        price: Number(currentMenuItem.price),
        description: currentMenuItem.description
      })
      .eq('id', currentMenuItem.id);
    
    if (!error) {
      toast({ title: 'Menu Item Updated', description: `${currentMenuItem.name} has been updated.` });
      setShowEditMenuItem(false);
      setCurrentMenuItem(null);
      
      // Refresh menu items
      const { data } = await supabase.from('menu_items').select('*');
      setMenuItems(data || []);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
  
  const handleDeleteMenuItem = async (id: string) => {
    setItemToDelete(id);
    setShowDeleteDialog(true);
  };
  
  const confirmDeleteMenuItem = async () => {
    if (!itemToDelete) return;
    
    const { error } = await supabase.from('menu_items').delete().eq('id', itemToDelete);
    
    if (!error) {
      toast({ title: 'Menu Item Deleted', description: 'The menu item has been removed.' });
      
      // Refresh menu items
      const { data } = await supabase.from('menu_items').select('*');
      setMenuItems(data || []);
      setShowDeleteDialog(false);
      setItemToDelete(null);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Logo upload functions
  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    
    setUploadingLogo(true);
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB');
      }
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('branding')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('branding')
        .getPublicUrl(fileName);
      
      // Update branding settings
      setBrandingSettings(prev => ({
        ...prev,
        logoUrl: publicUrl,
        useCustomLogo: true  // Automatically enable when logo is uploaded
      }));
      
      // Save settings immediately to persist the logo
      const newBrandingSettings = {
        customShopName: brandingSettings.customShopName,  // Preserve shop name
        primaryColor: brandingSettings.primaryColor,      // Preserve color
        logoUrl: publicUrl,
        useCustomLogo: true
      };
      
      const error = await saveSettings({
        branding_settings: newBrandingSettings
      });
      
      if (!error) {
        // Dispatch event to update sidebar immediately
        window.dispatchEvent(new CustomEvent('brandingUpdated'));
        
        toast({
          title: 'Logo Uploaded',
          description: 'Your logo has been uploaded and applied successfully.'
        });
      } else {
        toast({
          title: 'Logo Upload Failed',
          description: 'Logo uploaded but failed to save settings.',
          variant: 'destructive'
        });
      }
      
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      // If there's an existing logo, try to delete it from storage
      if (brandingSettings.logoUrl) {
        const fileName = brandingSettings.logoUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('branding').remove([fileName]);
        }
      }
      
      setBrandingSettings(prev => ({
        ...prev,
        logoUrl: '',
        useCustomLogo: false
      }));
      
      // Save settings immediately
      const newBrandingSettings = {
        customShopName: brandingSettings.customShopName,  // Preserve shop name
        primaryColor: brandingSettings.primaryColor,      // Preserve color
        logoUrl: '',
        useCustomLogo: false
      };
      
      const error = await saveSettings({
        branding_settings: newBrandingSettings
      });
      
      if (!error) {
        // Dispatch event to update sidebar immediately
        window.dispatchEvent(new CustomEvent('brandingUpdated'));
        
        toast({
          title: 'Logo Removed',
          description: 'Your logo has been removed successfully.'
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save settings after removing logo.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove logo.',
        variant: 'destructive'
      });
    }
  };

  const handleSaveBranding = async () => {
    // Validate branding settings
    if (!brandingSettings.customShopName.trim()) {
      toast({
        title: 'Missing Shop Name',
        description: 'Please enter a shop name for the sidebar.',
        variant: 'destructive'
      });
      return;
    }

    const error = await saveSettings();
    if (!error) {
      // Dispatch custom event to notify sidebar of changes
      window.dispatchEvent(new CustomEvent('brandingUpdated'));
      
      toast({
        title: 'Branding Updated',
        description: 'Your branding settings have been saved successfully.'
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <Tabs defaultValue="system" className="w-full">
        <TabsList className="grid w-full md:w-[900px] grid-cols-6">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="business">Business</TabsTrigger>}
          {isAdmin && <TabsTrigger value="receipts">Receipts</TabsTrigger>}
          {isAdmin && <TabsTrigger value="staff">Staff</TabsTrigger>}
          {isAdmin && <TabsTrigger value="menu">Menu Items</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure application behavior, shop information, and system preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Shop Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Shop Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shop-name">Official Business Name</Label>
                    <Input
                      id="shop-name"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="Creamello Ice Cream Shop"
                    />
                    <p className="text-sm text-muted-foreground">
                      Used on receipts, reports, and official documents
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Select a currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GHS">GHS (₵)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="CAD">CAD (C$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Branding Settings Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Branding & Appearance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sidebar-shop-name">App Display Name</Label>
                      <Input
                        id="sidebar-shop-name"
                        value={brandingSettings.customShopName}
                        onChange={(e) => setBrandingSettings({ ...brandingSettings, customShopName: e.target.value })}
                        placeholder="Creamello"
                      />
                      <p className="text-sm text-muted-foreground">
                        Short name shown in the sidebar and app interface
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="primary-color">Primary Brand Color</Label>
                      <div className="flex items-center space-x-2">
                        <div 
                          className="h-8 w-8 rounded-lg border border-input" 
                          style={{ backgroundColor: brandingSettings.primaryColor }} 
                        />
                        <Input
                          id="primary-color"
                          type="color"
                          value={brandingSettings.primaryColor}
                          onChange={(e) => setBrandingSettings({ ...brandingSettings, primaryColor: e.target.value })}
                          className="w-20 h-8 p-1 border rounded"
                        />
                        <span className="text-sm text-muted-foreground">
                          {brandingSettings.primaryColor}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Used for sidebar icon background and accent colors
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Shop Logo</Label>
                      <div className="flex items-center space-x-4">
                        {brandingSettings.useCustomLogo && brandingSettings.logoUrl ? (
                          <img
                            src={brandingSettings.logoUrl}
                            alt="Shop Logo"
                            className="h-16 w-16 object-contain rounded-lg border border-input"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border border-input">
                            <span className="text-xs">No Logo</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          <input
                            type="file"
                            id="logo-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleLogoUpload(file);
                              }
                            }}
                          />
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                              disabled={uploadingLogo}
                            >
                              {uploadingLogo ? 'Uploading...' : brandingSettings.logoUrl ? 'Change' : 'Upload'}
                            </Button>
                            {brandingSettings.logoUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRemoveLogo}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="use-custom-logo"
                              checked={brandingSettings.useCustomLogo}
                              onCheckedChange={(checked) => setBrandingSettings({ ...brandingSettings, useCustomLogo: checked })}
                            />
                            <Label htmlFor="use-custom-logo" className="text-sm">Use custom logo</Label>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Upload a logo to replace the default icon in the sidebar (max 2MB)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Application Preferences Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Application Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select value={theme} onValueChange={v => setTheme(v)}>
                      <SelectTrigger id="theme">
                        <SelectValue placeholder="Select a theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <Select value={dateFormat} onValueChange={v => setDateFormat(v)}>
                      <SelectTrigger id="dateFormat">
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Refresh Dashboard</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically refresh dashboard data every 5 minutes
                    </p>
                  </div>
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                </div>
              </div>
              
              {/* System Security Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Security & Access</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enable PIN Security</p>
                      <p className="text-sm text-muted-foreground">
                        Require PIN authentication for sensitive operations
                      </p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Lock After Inactivity</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically lock the application after 30 minutes of inactivity
                      </p>
                    </div>
                    <Switch defaultChecked={false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enable Audit Logging</p>
                      <p className="text-sm text-muted-foreground">
                        Track all user actions for security and compliance
                      </p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                </div>
              </div>
              
              {/* System Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">System Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm font-medium">Application Version</div>
                      <div className="text-sm text-muted-foreground">v1.0.0</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm font-medium">Database Status</div>
                      <div className={`text-sm ${systemStats.isDbConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {systemStats.isDbConnected ? 'Connected' : 'Disconnected'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm font-medium">Total Orders</div>
                      <div className="text-sm text-muted-foreground">{systemStats.totalOrders.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm font-medium">Active Staff</div>
                      <div className="text-sm text-muted-foreground">{staffList.length} members</div>
                    </div>
                  </div>
                </div>
              </div>
              
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSystem}>Save Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how and when you receive alerts and notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Low Stock Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified when ingredients fall below threshold
                  </p>
                </div>
                <Switch 
                  checked={notifications.lowStock} 
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, lowStock: checked})
                  } 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Expiration Warnings</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified about ingredients or products expiring soon
                  </p>
                </div>
                <Switch 
                  checked={notifications.expiryAlert} 
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, expiryAlert: checked})
                  } 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Sales Reports</p>
                  <p className="text-sm text-muted-foreground">
                    Receive daily sales summary reports
                  </p>
                </div>
                <Switch 
                  checked={notifications.salesReport} 
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, salesReport: checked})
                  } 
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Production Reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Get reminders for scheduled production batches
                  </p>
                </div>
                <Switch 
                  checked={notifications.productionReminders} 
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, productionReminders: checked})
                  } 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveNotifications}>Save Preferences</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="business">
            <Card>
              <CardHeader>
                <CardTitle>Business Operations</CardTitle>
                <CardDescription>
                  Configure business hours, inventory thresholds, and operational settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Business Hours Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Business Hours</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="openTime">Opening Time</Label>
                      <Input
                        id="openTime"
                        type="time"
                        value={businessHours.openTime}
                        onChange={(e) => setBusinessHours({ ...businessHours, openTime: e.target.value })}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="closeTime">Closing Time</Label>
                      <Input
                        id="closeTime"
                        type="time"
                        value={businessHours.closeTime}
                        onChange={(e) => setBusinessHours({ ...businessHours, closeTime: e.target.value })}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    These hours affect order taking availability and dashboard analytics.
                  </p>
                </div>

                {/* Inventory Management Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Inventory Management</h3>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Receive alerts when inventory items drop below this quantity.
                    </p>
                  </div>
                </div>

                {/* Order Management Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Order Management</h3>
                  <div className="space-y-2">
                    <Label htmlFor="autoCompleteMinutes">Auto-Complete Orders After</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="autoCompleteMinutes"
                        type="number"
                        min="0"
                        value={autoCompleteMinutes}
                        onChange={(e) => setAutoCompleteMinutes(Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Automatically mark orders as completed after this time (0 = disabled).
                    </p>
                  </div>
                </div>

                {/* Financial Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Financial Settings</h3>
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Tax Rate (%)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="taxRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sales tax rate applied to orders (if applicable).
                    </p>
                  </div>
                </div>

              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveBusinessOperations} className="w-full md:w-auto">
                  Save Business Settings
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="receipts">
            <div className="space-y-6">
              
              {/* Receipt Template Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Receipt Template</CardTitle>
                  <CardDescription>
                    Configure your receipt layout for POS printer compatibility (58mm/80mm thermal printers).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Basic Info Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Shop Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shop-name">Shop Name</Label>
                        <Input
                          id="shop-name"
                          value={receiptTemplate.shopName}
                          onChange={(e) => setReceiptTemplate({ ...receiptTemplate, shopName: e.target.value })}
                          placeholder="CREAMELLO"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="receipt-phone">Phone Number</Label>
                        <Input
                          id="receipt-phone"
                          value={receiptTemplate.phone}
                          onChange={(e) => setReceiptTemplate({ ...receiptTemplate, phone: e.target.value })}
                          placeholder="055-123-4567"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receipt-address">Address</Label>
                      <Textarea
                        id="receipt-address"
                        value={receiptTemplate.address}
                        onChange={(e) => setReceiptTemplate({ ...receiptTemplate, address: e.target.value })}
                        placeholder="123 Ice Cream Lane, Accra"
                        className="resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Printer Settings */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Printer Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="paper-size">Paper Size</Label>
                        <Select 
                          value={receiptTemplate.paperSize} 
                          onValueChange={(v) => {
                            const width = v === '58mm' ? 32 : 48;
                            setReceiptTemplate({ ...receiptTemplate, paperSize: v, width });
                          }}
                        >
                          <SelectTrigger id="paper-size">
                            <SelectValue placeholder="Select paper size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="58mm">58mm (32 chars)</SelectItem>
                            <SelectItem value="80mm">80mm (48 chars)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="receipt-width">Character Width</Label>
                        <Input
                          id="receipt-width"
                          type="number"
                          min="20"
                          max="80"
                          value={receiptTemplate.width}
                          onChange={(e) => setReceiptTemplate({ ...receiptTemplate, width: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cut-type">Paper Cut</Label>
                        <Select 
                          value={receiptTemplate.cutType} 
                          onValueChange={(v) => setReceiptTemplate({ ...receiptTemplate, cutType: v })}
                        >
                          <SelectTrigger id="cut-type">
                            <SelectValue placeholder="Select cut type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full Cut</SelectItem>
                            <SelectItem value="partial">Partial Cut</SelectItem>
                            <SelectItem value="none">No Cut</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Layout Options */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Receipt Layout</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Show Header</p>
                            <p className="text-sm text-muted-foreground">Display shop name and address</p>
                          </div>
                          <Switch 
                            checked={receiptTemplate.showHeader} 
                            onCheckedChange={(checked) => 
                              setReceiptTemplate({ ...receiptTemplate, showHeader: checked })
                            } 
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Show Date & Time</p>
                            <p className="text-sm text-muted-foreground">Display order timestamp</p>
                          </div>
                          <Switch 
                            checked={receiptTemplate.showDateTime} 
                            onCheckedChange={(checked) => 
                              setReceiptTemplate({ ...receiptTemplate, showDateTime: checked })
                            } 
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Show Staff Info</p>
                            <p className="text-sm text-muted-foreground">Display staff member name</p>
                          </div>
                          <Switch 
                            checked={receiptTemplate.showStaffInfo} 
                            onCheckedChange={(checked) => 
                              setReceiptTemplate({ ...receiptTemplate, showStaffInfo: checked })
                            } 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Show Table Info</p>
                            <p className="text-sm text-muted-foreground">Display table number</p>
                          </div>
                          <Switch 
                            checked={receiptTemplate.showTableInfo} 
                            onCheckedChange={(checked) => 
                              setReceiptTemplate({ ...receiptTemplate, showTableInfo: checked })
                            } 
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Show Customer Info</p>
                            <p className="text-sm text-muted-foreground">Display customer name</p>
                          </div>
                          <Switch 
                            checked={receiptTemplate.showCustomerInfo} 
                            onCheckedChange={(checked) => 
                              setReceiptTemplate({ ...receiptTemplate, showCustomerInfo: checked })
                            } 
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Show QR Code</p>
                            <p className="text-sm text-muted-foreground">Display QR code for order</p>
                          </div>
                          <Switch 
                            checked={receiptTemplate.showQrCode} 
                            onCheckedChange={(checked) => 
                              setReceiptTemplate({ ...receiptTemplate, showQrCode: checked })
                            } 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Text Content */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Custom Messages</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="header-text">Header Text</Label>
                        <Input
                          id="header-text"
                          value={receiptTemplate.headerText}
                          onChange={(e) => setReceiptTemplate({ ...receiptTemplate, headerText: e.target.value })}
                          placeholder="CASH RECEIPT"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="footer-message">Footer Message</Label>
                        <Textarea
                          id="footer-message"
                          value={receiptTemplate.footerText}
                          onChange={(e) => setReceiptTemplate({ ...receiptTemplate, footerText: e.target.value })}
                          placeholder="Thank you for your business!&#10;Visit us again soon!"
                          className="resize-none"
                          rows={3}
                        />
                        <p className="text-sm text-muted-foreground">
                          Use \n for line breaks
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-message">Custom Message</Label>
                        <Textarea
                          id="custom-message"
                          value={receiptTemplate.customMessage}
                          onChange={(e) => setReceiptTemplate({ ...receiptTemplate, customMessage: e.target.value })}
                          placeholder="Special promotions, opening hours, etc."
                          className="resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>

                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveReceiptSettings} className="w-full md:w-auto">
                    Save Receipt Settings
                  </Button>
                </CardFooter>
              </Card>

              {/* Receipt Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Receipt Preview</CardTitle>
                  <CardDescription>
                    Preview how your receipt will look on POS printers.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Receipt 
                    template={receiptTemplate}
                    order={{
                      id: 'preview-order',
                      orderNumber: 'ORD-001',
                      items: [
                        {
                          name: 'Vanilla Ice Cream',
                          quantity: 2,
                          price: 5.00,
                          total: 10.00
                        },
                        {
                          name: 'Chocolate Sauce',
                          quantity: 1,
                          price: 2.00,
                          total: 2.00
                        }
                      ],
                      subtotal: 12.00,
                      tax: 0,
                      total: 12.00,
                      paymentMethod: 'Cash',
                      amountPaid: 15.00,
                      change: 3.00,
                      customerName: 'John Doe',
                      tableNumber: '5',
                      staffName: 'Sample Staff',
                      createdAt: new Date().toISOString()
                    }}
                    isPreview={true}
                  />
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button onClick={handleTestPrint} variant="outline" className="flex-1">
                    🖨️ Test Print
                  </Button>
                  <Button 
                    onClick={() => {
                      // Copy receipt text to clipboard for debugging
                      const testOrder = {
                        id: 'test-order',
                        orderNumber: 'TEST-001',
                        items: [
                          { name: 'Vanilla Ice Cream', quantity: 2, price: 5.00, total: 10.00 },
                          { name: 'Chocolate Sauce', quantity: 1, price: 2.00, total: 2.00 }
                        ],
                        subtotal: 12.00, tax: 0, total: 12.00, paymentMethod: 'Cash',
                        amountPaid: 15.00, change: 3.00, customerName: 'Test Customer',
                        tableNumber: '5', staffName: 'Test Staff', createdAt: new Date().toISOString()
                      };
                      
                      import('@/utils/receiptPrinter').then(({ ReceiptPrinter }) => {
                        const printer = new ReceiptPrinter(receiptTemplate);
                        const receiptText = printer.generateReceiptText(testOrder);
                        navigator.clipboard.writeText(receiptText);
                        toast({ title: 'Receipt Text Copied', description: 'Raw receipt text copied to clipboard for debugging.' });
                      });
                    }}
                    variant="ghost" 
                    size="sm"
                  >
                    📋 Copy Raw
                  </Button>
                </CardFooter>
              </Card>
              
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle>Staff Management</CardTitle>
                <CardDescription>View, add, and manage staff accounts and roles.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-semibold">All Staff</div>
                  <Button onClick={() => setShowAddStaff(true)}>+ Add Staff</Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-muted">
                  <table className="min-w-full divide-y divide-muted bg-white">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Name</th>
                        <th className="px-4 py-2 text-left font-medium">Role</th>
                        <th className="px-4 py-2 text-left font-medium">PIN</th>
                        <th className="px-4 py-2 text-left font-medium">Access Permissions</th>
                        <th className="px-4 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((s) => {
                        // Use default permissions based on role since permissions column doesn't exist
                        const permissions = getDefaultPermissions(s.role);
                        const activePermissions = Object.entries(permissions)
                          .filter(([_, value]) => value)
                          .map(([key, _]) => key)
                          .join(', ');
                        
                        return (
                          <tr key={s.id} className="even:bg-muted/50">
                            <td className="px-4 py-2">{s.name}</td>
                            <td className="px-4 py-2 capitalize">{s.role}</td>
                            <td className="px-4 py-2 font-mono tracking-wider">{'*'.repeat(s.pin.length)}</td>
                            <td className="px-4 py-2 max-w-xs">
                              <div className="text-sm text-muted-foreground truncate">
                                {activePermissions || 'No permissions'}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManagePermissions(s)}
                                className="flex items-center gap-1"
                              >
                                <Shield className="h-4 w-4" />
                                Permissions
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Staff Work Hours Section */}
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-lg font-semibold">Staff Work Hours</div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="week-select">Week:</Label>
                      <Input
                        id="week-select"
                        type="date"
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="w-40"
                      />
                    </div>
                  </div>
                  
                  {/* Daily Hours Summary */}
                  <div className="space-y-4">
                    {Object.keys(dailyHours).length > 0 ? (
                      Object.entries(dailyHours).map(([staffId, data]: [string, any]) => (
                        <Card key={staffId} className="overflow-hidden">
                          <CardHeader className="py-3">
                            <div className="flex justify-between items-center">
                              <CardTitle className="text-base">{data.name}</CardTitle>
                              <div className="text-sm font-medium text-muted-foreground">
                                Total: {data.totalHours.toFixed(1)} hours
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full divide-y divide-muted">
                                <thead className="bg-muted">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Date</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium">Hours Worked</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-muted">
                                  {Object.entries(data.days).map(([day, hours]: [string, any]) => (
                                    <tr key={day}>
                                      <td className="px-4 py-2 text-sm">
                                        {format(parseISO(day), 'MMM dd, yyyy (EEE)')}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right font-medium">
                                        {Number(hours).toFixed(1)} h
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="mx-auto h-12 w-12 opacity-20 mb-2" />
                        <p>No work hours data available for the selected week.</p>
                        <p className="text-sm">Work hours are tracked automatically when staff login and logout.</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Recent Attendance Records */}
                  <div className="mt-6">
                    <div className="text-md font-semibold mb-3">Recent Attendance Records</div>
                    <div className="overflow-x-auto rounded-lg border border-muted">
                      <table className="min-w-full divide-y divide-muted bg-white">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium">Staff Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Login Time</th>
                            <th className="px-4 py-2 text-left text-xs font-medium">Logout Time</th>
                            <th className="px-4 py-2 text-right text-xs font-medium">Hours Worked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffAttendance.length > 0 ? (
                            staffAttendance.map((record) => (
                              <tr key={record.id} className="even:bg-muted/50">
                                <td className="px-4 py-2">{record.staff_name}</td>
                                <td className="px-4 py-2">
                                  {format(new Date(record.login_time), 'MMM dd, yyyy HH:mm')}
                                </td>
                                <td className="px-4 py-2">
                                  {record.logout_time 
                                    ? format(new Date(record.logout_time), 'MMM dd, yyyy HH:mm')
                                    : <span className="text-amber-500">Still Active</span>
                                  }
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {record.total_minutes 
                                    ? `${(record.total_minutes / 60).toFixed(1)} h`
                                    : '-'
                                  }
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                                No attendance records found for the selected week.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Dialog open={showAddStaff} onOpenChange={setShowAddStaff}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Staff</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>PIN</Label>
                    <Input value={newStaff.pin} onChange={e => setNewStaff({ ...newStaff, pin: e.target.value })} type="password" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={newStaff.role} onValueChange={v => setNewStaff({ ...newStaff, role: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddStaff(false)}>Cancel</Button>
                  <Button onClick={handleAddStaff}>Add Staff</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Staff Permissions Management Dialog */}
            <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Manage Access Permissions
                  </DialogTitle>
                  <DialogDescription>
                    Configure which navigation tabs {selectedStaffForPermissions?.name} can access.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-4">
                    {Object.entries(tempPermissions).map(([permission, enabled]) => {
                      const permissionLabels: Record<string, { label: string; description: string }> = {
                        dashboard: { 
                          label: 'Dashboard', 
                          description: 'View sales dashboard and analytics' 
                        },
                        orders: { 
                          label: 'Orders', 
                          description: 'Manage customer orders and POS' 
                        },
                        production: { 
                          label: 'Production', 
                          description: 'Manage production batches and schedules' 
                        },
                        inventory: { 
                          label: 'Inventory', 
                          description: 'Manage stock and inventory items' 
                        },
                        reports: { 
                          label: 'Reports', 
                          description: 'View detailed reports and analytics' 
                        },
                        settings: { 
                          label: 'Settings', 
                          description: 'Access system settings and configuration' 
                        },
                      };

                      const { label, description } = permissionLabels[permission];

                      return (
                        <div key={permission} className="flex items-center justify-between space-x-2">
                          <div className="flex-1">
                            <div className="font-medium">{label}</div>
                            <div className="text-sm text-muted-foreground">{description}</div>
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) =>
                              setTempPermissions(prev => ({
                                ...prev,
                                [permission]: checked
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      <strong>Note:</strong> Changes will take effect the next time the user logs in.
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePermissions}>
                    Save Permissions
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
        
        {isAdmin && (
          <TabsContent value="menu">
            <Card>
              <CardHeader>
                <CardTitle>Menu Items Management</CardTitle>
                <CardDescription>View, add, edit, and remove menu items available for ordering.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-semibold">All Menu Items</div>
                  <Button onClick={() => setShowAddMenuItem(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Menu Item
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-muted">
                  <table className="min-w-full divide-y divide-muted bg-white">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Name</th>
                        <th className="px-4 py-2 text-left font-medium">Category</th>
                        <th className="px-4 py-2 text-left font-medium">Price</th>
                        <th className="px-4 py-2 text-left font-medium">Description</th>
                        <th className="px-4 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map((item) => (
                        <tr key={item.id} className="even:bg-muted/50">
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2">{item.category}</td>
                          <td className="px-4 py-2">{currency} {item.price.toFixed(2)}</td>
                          <td className="px-4 py-2 max-w-xs truncate">{item.description || '-'}</td>
                          <td className="px-4 py-2 text-right">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setCurrentMenuItem(item);
                                setShowEditMenuItem(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteMenuItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            
            {/* Add Menu Item Dialog */}
            <Dialog open={showAddMenuItem} onOpenChange={setShowAddMenuItem}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Menu Item</DialogTitle>
                  <DialogDescription>
                    Add a new item to your menu for ordering.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="item-name">Name</Label>
                    <Input 
                      id="item-name"
                      value={newMenuItem.name} 
                      onChange={e => setNewMenuItem({ ...newMenuItem, name: e.target.value })} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-category">Category</Label>
                    <Select 
                      value={newMenuItem.category} 
                      onValueChange={v => setNewMenuItem({ ...newMenuItem, category: v })}
                    >
                      <SelectTrigger id="item-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {MENU_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="item-price">Price</Label>
                    <Input 
                      id="item-price"
                      type="number" 
                      min="0" 
                      step="0.01"
                      value={newMenuItem.price} 
                      onChange={e => setNewMenuItem({ ...newMenuItem, price: parseFloat(e.target.value) })} 
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-description">Description (optional)</Label>
                    <Textarea 
                      id="item-description"
                      value={newMenuItem.description || ''} 
                      onChange={e => setNewMenuItem({ ...newMenuItem, description: e.target.value })} 
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddMenuItem(false)}>Cancel</Button>
                  <Button onClick={handleAddMenuItem}>Add Item</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Edit Menu Item Dialog */}
            <Dialog open={showEditMenuItem} onOpenChange={setShowEditMenuItem}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Menu Item</DialogTitle>
                </DialogHeader>
                {currentMenuItem && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-item-name">Name</Label>
                      <Input 
                        id="edit-item-name"
                        value={currentMenuItem.name} 
                        onChange={e => setCurrentMenuItem({ ...currentMenuItem, name: e.target.value })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-item-category">Category</Label>
                      <Select 
                        value={currentMenuItem.category} 
                        onValueChange={v => setCurrentMenuItem({ ...currentMenuItem, category: v })}
                      >
                        <SelectTrigger id="edit-item-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {MENU_CATEGORIES.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-item-price">Price</Label>
                      <Input 
                        id="edit-item-price"
                        type="number" 
                        min="0" 
                        step="0.01"
                        value={currentMenuItem.price} 
                        onChange={e => setCurrentMenuItem({ ...currentMenuItem, price: parseFloat(e.target.value) })} 
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-item-description">Description (optional)</Label>
                      <Textarea 
                        id="edit-item-description"
                        value={currentMenuItem.description || ''} 
                        onChange={e => setCurrentMenuItem({ ...currentMenuItem, description: e.target.value })} 
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowEditMenuItem(false)}>Cancel</Button>
                  <Button onClick={handleEditMenuItem}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {/* Delete Menu Item Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Menu Item</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this menu item? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={confirmDeleteMenuItem}>Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
