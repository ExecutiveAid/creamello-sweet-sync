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
import { updateBrandColors, saveBrandColor } from '@/utils/themeUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Pencil, Trash2, Plus, Clock, Calendar, Settings as SettingsIcon, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
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
  recipe?: SundaeIngredient[] | null;
}

// Sundae ingredient interface (matching the config file)
interface SundaeIngredient {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
}



// Type for inventory units
interface InventoryUnit {
  name: string;
  type: 'weight' | 'volume' | 'count' | 'container';
  description: string;
}

// Type for suppliers
interface Supplier {
  id: string;
  name: string;
  code: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  business_type?: string;
  tax_id?: string;
  registration_number?: string;
  payment_terms?: string;
  credit_limit?: number;
  discount_percentage?: number;
  lead_time_days?: number;
  minimum_order_amount?: number;
  categories?: string[];
  is_active: boolean;
  is_preferred: boolean;
  notes?: string;
}

// Type for supplier settings
interface SupplierSettings {
  default_payment_terms: string;
  default_lead_time_days: number;
  require_supplier_approval: boolean;
  auto_generate_supplier_codes: boolean;
  supplier_code_prefix: string;
  default_country: string;
  default_currency: string;
}

// Default menu categories (fallback)
const DEFAULT_MENU_CATEGORIES = [
  'Flavors',
  'Toppings',
  'Waffles & Pancakes',
  'Sundaes',
  'Milkshakes',
  'Juice',
];

// Default inventory categories (fallback)
const DEFAULT_INVENTORY_CATEGORIES = [
  'Gelato',
  'Juices', 
  'Milkshakes',
  'Pancakes',
  'Waffles',
  'Sundaes',
  'Cones',
  'Toppings',
  'Dairy',
  'Ingredients',
  'Packaging',
  'Supplies',
  'Other'
];

// Default inventory units (fallback)
const DEFAULT_INVENTORY_UNITS: InventoryUnit[] = [
  { name: 'kg', type: 'weight', description: 'Kilograms' },
  { name: 'g', type: 'weight', description: 'Grams' },
  { name: 'L', type: 'volume', description: 'Liters' },
  { name: 'ml', type: 'volume', description: 'Milliliters' },
  { name: 'pieces', type: 'count', description: 'Individual pieces' },
  { name: 'pcs', type: 'count', description: 'Pieces' },
  { name: 'boxes', type: 'container', description: 'Boxes' },
  { name: 'packs', type: 'container', description: 'Packs' },
  { name: 'bottles', type: 'container', description: 'Bottles' },
  { name: 'bags', type: 'container', description: 'Bags' },
  { name: 'containers', type: 'container', description: 'Containers' },
  { name: 'rolls', type: 'container', description: 'Rolls' },
  { name: 'sheets', type: 'container', description: 'Sheets' }
];

// ===== Enhanced Business-Profile Types =====

interface BusinessProfile {
  legalBusinessName: string;
  displayName: string;
  tradingAs: string;
  businessType: string;
  description: string;
  industryType: string;
  yearEstablished: string;
  numberOfEmployees: string;
}

interface LegalInfo {
  registrationNumber: string;
  taxIdentificationNumber: string;
  vatNumber: string;
}

interface ContactInfo {
  phone: string;
  mobile: string;
  website: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface LocationInfo {
  locationType: 'single' | 'chain' | 'franchise';
  locationCode: string;
  timezone: string;
}

const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  legalBusinessName: '',
  displayName: '',
  tradingAs: '',
  businessType: 'sole_proprietorship',
  description: '',
  industryType: 'food_service',
  yearEstablished: '',
  numberOfEmployees: '1-10',
};

const DEFAULT_LEGAL_INFO: LegalInfo = {
  registrationNumber: '',
  taxIdentificationNumber: '',
  vatNumber: '',
};

const DEFAULT_CONTACT_INFO: ContactInfo = {
  phone: '',
  mobile: '',
  website: '',
  addressLine1: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

const DEFAULT_LOCATION_INFO: LocationInfo = {
  locationType: 'single',
  locationCode: '',
  timezone: 'Africa/Accra',
};

const Settings = () => {
  const [shopName, setShopName] = useState('Razorbill IMS');
  const [email, setEmail] = useState('contact@razorbill.com');
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
  

  
  // Menu items state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>(DEFAULT_MENU_CATEGORIES);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);
  const [showEditMenuItem, setShowEditMenuItem] = useState(false);
  const [currentMenuItem, setCurrentMenuItem] = useState<MenuItem | null>(null);
  const [newMenuItem, setNewMenuItem] = useState<Partial<MenuItem>>({
    name: '',
    category: 'Flavors',
    price: 0,
    description: '',
    recipe: null,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Category management state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Inventory configuration state
  const [inventoryCategories, setInventoryCategories] = useState<string[]>(DEFAULT_INVENTORY_CATEGORIES);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryUnit[]>(DEFAULT_INVENTORY_UNITS);
  
  // Inventory category management state
  const [showInventoryCategoryManager, setShowInventoryCategoryManager] = useState(false);
  const [newInventoryCategoryName, setNewInventoryCategoryName] = useState('');
  const [editingInventoryCategoryIndex, setEditingInventoryCategoryIndex] = useState<number | null>(null);
  const [editingInventoryCategoryName, setEditingInventoryCategoryName] = useState('');
  
  // Inventory units management state
  const [showInventoryUnitManager, setShowInventoryUnitManager] = useState(false);
  const [newInventoryUnit, setNewInventoryUnit] = useState<InventoryUnit>({ name: '', type: 'count', description: '' });
  const [editingInventoryUnitIndex, setEditingInventoryUnitIndex] = useState<number | null>(null);
  const [editingInventoryUnit, setEditingInventoryUnit] = useState<InventoryUnit>({ name: '', type: 'count', description: '' });

  // Supplier management state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSettings, setSupplierSettings] = useState<SupplierSettings>({
    default_payment_terms: 'net30',
    default_lead_time_days: 7,
    require_supplier_approval: false,
    auto_generate_supplier_codes: true,
    supplier_code_prefix: 'SUP',
    default_country: 'Ghana',
    default_currency: 'GHS'
  });
  const [showSupplierManager, setShowSupplierManager] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showEditSupplier, setShowEditSupplier] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    business_type: 'local',
    payment_terms: 'net30',
    lead_time_days: 7,
    is_active: true,
    is_preferred: false,
    categories: [],
    country: 'Ghana'
  });

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
    footerText: 'Thank you for choosing Razorbill IMS!'
  });

  // Receipt Template settings
  const [receiptTemplate, setReceiptTemplate] = useState({
    shopName: 'RAZORBILL IMS',
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
    customShopName: 'Razorbill IMS', // For sidebar display
    logoUrl: '',
    primaryColor: '#8B5CF6', // Default purple
    useCustomLogo: false
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Inventory items for ingredient picker
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(DEFAULT_BUSINESS_PROFILE);
  const [legalInfo, setLegalInfo] = useState<LegalInfo>(DEFAULT_LEGAL_INFO);
  const [contactInfo, setContactInfo] = useState<ContactInfo>(DEFAULT_CONTACT_INFO);
  const [locationInfo, setLocationInfo] = useState<LocationInfo>(DEFAULT_LOCATION_INFO);

  // Add state for invoice layout settings
  const [invoiceLayout, setInvoiceLayout] = useState({
    businessName: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: '',
    footer: 'Thank you for your business!'
  });
  const [invoiceLogoFile, setInvoiceLogoFile] = useState<File | null>(null);

  // Invoice layout settings are now loaded in the main fetchSettings useEffect

  // Apply brand colors when they change
  useEffect(() => {
    if (brandingSettings.primaryColor) {
      updateBrandColors(brandingSettings.primaryColor);
      saveBrandColor(brandingSettings.primaryColor);
    }
  }, [brandingSettings.primaryColor]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
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
        
        // Load invoice layout settings
        if (data.invoice_layout) {
          console.log('Loading invoice layout from settings:', data.invoice_layout);
          setInvoiceLayout(data.invoice_layout);
        } else {
          console.log('No invoice layout found, using defaults');
          setInvoiceLayout({
            businessName: '',
            address: '',
            phone: '',
            email: '',
            logoUrl: '',
            footer: 'Thank you for your business!'
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

        setBusinessProfile({ ...DEFAULT_BUSINESS_PROFILE, ...(data.business_profile || {}) });
        setLegalInfo({ ...DEFAULT_LEGAL_INFO, ...(data.legal_info || {}) });
        setContactInfo(prev => ({ ...prev, ...(data.contact_info || {}) }));
        setLocationInfo({ ...DEFAULT_LOCATION_INFO, ...(data.location_info || {}) });
        
        // Load menu categories
        setMenuCategories(data.menu_categories || DEFAULT_MENU_CATEGORIES);
        
        // Load inventory configuration
        setInventoryCategories(data.inventory_categories || DEFAULT_INVENTORY_CATEGORIES);
        setInventoryUnits(data.inventory_units || DEFAULT_INVENTORY_UNITS);
        
        // Load supplier settings
        setSupplierSettings(data.supplier_settings || {
          default_payment_terms: 'net30',
          default_lead_time_days: 7,
          require_supplier_approval: false,
          auto_generate_supplier_codes: true,
          supplier_code_prefix: 'SUP',
          default_country: 'Ghana',
          default_currency: 'GHS'
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
      
      // Fetch suppliers
      const fetchSuppliers = async () => {
        const { data, error } = await supabase.from('suppliers').select('*').order('name');
        if (error) {
          console.error('Error fetching suppliers:', error);
        } else {
          setSuppliers(data || []);
        }
      };
      
      // Fetch inventory items for ingredient picker
      const fetchInventoryItems = async () => {
        const { data, error } = await supabase
          .from('inventory')
          .select('id, name, category, unit, available_quantity')
          .eq('is_active', true)
          .gt('available_quantity', 0)
          .order('name');
        if (!error) {
          setInventoryItems(data || []);
        }
      };
      
      fetchSuppliers();
      fetchInventoryItems();
      fetchSystemStats();
    }
      }, [isAdmin]);
  


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
      business_profile: businessProfile,
      legal_info: legalInfo,
      contact_info: contactInfo,
      location_info: locationInfo,
      menu_categories: menuCategories,
      inventory_categories: inventoryCategories,
      inventory_units: inventoryUnits,
      supplier_settings: supplierSettings,
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
      description: newMenuItem.description || null,
      recipe: newMenuItem.category === 'Sundaes' && newMenuItem.recipe ? newMenuItem.recipe : null
    };
    
    const { error } = await supabase.from('menu_items').insert([menuItem]);
    
    if (!error) {
      toast({ title: 'Menu Item Added', description: `${menuItem.name} added to ${menuItem.category}.` });
      setShowAddMenuItem(false);
      setNewMenuItem({ name: '', category: 'Flavors', price: 0, description: '', recipe: null });
      
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
        description: currentMenuItem.description,
        recipe: currentMenuItem.category === 'Sundaes' && currentMenuItem.recipe ? currentMenuItem.recipe : null
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

  // Category management functions
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: 'Missing Category Name', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }
    
    if (menuCategories.includes(newCategoryName.trim())) {
      toast({ title: 'Category Exists', description: 'This category already exists.', variant: 'destructive' });
      return;
    }
    
    const updatedCategories = [...menuCategories, newCategoryName.trim()];
    setMenuCategories(updatedCategories);
    
    const error = await saveSettings({ menu_categories: updatedCategories });
    if (!error) {
      toast({ title: 'Category Added', description: `${newCategoryName} has been added to menu categories.` });
      setNewCategoryName('');
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setMenuCategories(menuCategories); // Revert on error
    }
  };

  const handleEditCategory = async (index: number) => {
    if (!editingCategoryName.trim()) {
      toast({ title: 'Missing Category Name', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }
    
    if (menuCategories.includes(editingCategoryName.trim()) && editingCategoryName.trim() !== menuCategories[index]) {
      toast({ title: 'Category Exists', description: 'This category already exists.', variant: 'destructive' });
      return;
    }
    
    const oldCategoryName = menuCategories[index];
    const updatedCategories = [...menuCategories];
    updatedCategories[index] = editingCategoryName.trim();
    setMenuCategories(updatedCategories);
    
    // Update menu items with old category name
    const itemsToUpdate = menuItems.filter(item => item.category === oldCategoryName);
    if (itemsToUpdate.length > 0) {
      for (const item of itemsToUpdate) {
        await supabase
          .from('menu_items')
          .update({ category: editingCategoryName.trim() })
          .eq('id', item.id);
      }
      
      // Refresh menu items
      const { data } = await supabase.from('menu_items').select('*');
      setMenuItems(data || []);
    }
    
    const error = await saveSettings({ menu_categories: updatedCategories });
    if (!error) {
      toast({ title: 'Category Updated', description: `Category has been updated to ${editingCategoryName}.` });
      setEditingCategoryIndex(null);
      setEditingCategoryName('');
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setMenuCategories(menuCategories); // Revert on error
    }
  };

  const handleDeleteCategory = async (index: number) => {
    const categoryToDelete = menuCategories[index];
    
    // Check if any menu items use this category
    const itemsUsingCategory = menuItems.filter(item => item.category === categoryToDelete);
    if (itemsUsingCategory.length > 0) {
      toast({ 
        title: 'Cannot Delete Category', 
        description: `This category is used by ${itemsUsingCategory.length} menu item(s). Please reassign or delete those items first.`,
        variant: 'destructive' 
      });
      return;
    }
    
    const updatedCategories = menuCategories.filter((_, i) => i !== index);
    setMenuCategories(updatedCategories);
    
    const error = await saveSettings({ menu_categories: updatedCategories });
    if (!error) {
      toast({ title: 'Category Deleted', description: `${categoryToDelete} has been removed from menu categories.` });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setMenuCategories(menuCategories); // Revert on error
    }
  };

  // Inventory category management functions
  const handleAddInventoryCategory = async () => {
    if (!newInventoryCategoryName.trim()) {
      toast({ title: 'Missing Category Name', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }
    
    if (inventoryCategories.includes(newInventoryCategoryName.trim())) {
      toast({ title: 'Category Exists', description: 'This category already exists.', variant: 'destructive' });
      return;
    }
    
    const updatedCategories = [...inventoryCategories, newInventoryCategoryName.trim()];
    setInventoryCategories(updatedCategories);
    
    const error = await saveSettings({ inventory_categories: updatedCategories });
    if (!error) {
      toast({ title: 'Category Added', description: `${newInventoryCategoryName} has been added to inventory categories.` });
      setNewInventoryCategoryName('');
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setInventoryCategories(inventoryCategories); // Revert on error
    }
  };

  const handleEditInventoryCategory = async (index: number) => {
    if (!editingInventoryCategoryName.trim()) {
      toast({ title: 'Missing Category Name', description: 'Please enter a category name.', variant: 'destructive' });
      return;
    }
    
    if (inventoryCategories.includes(editingInventoryCategoryName.trim()) && editingInventoryCategoryName.trim() !== inventoryCategories[index]) {
      toast({ title: 'Category Exists', description: 'This category already exists.', variant: 'destructive' });
      return;
    }
    
    const oldCategoryName = inventoryCategories[index];
    const updatedCategories = [...inventoryCategories];
    updatedCategories[index] = editingInventoryCategoryName.trim();
    setInventoryCategories(updatedCategories);
    
    // Update inventory items with old category name
    try {
      const { data: itemsToUpdate, error: fetchError } = await supabase
        .from('inventory')
        .select('id, category')
        .eq('category', oldCategoryName);
      
      if (!fetchError && itemsToUpdate && itemsToUpdate.length > 0) {
        for (const item of itemsToUpdate) {
          await supabase
            .from('inventory')
            .update({ category: editingInventoryCategoryName.trim() })
            .eq('id', item.id);
        }
      }
    } catch (err) {
      console.error('Error updating inventory items:', err);
    }
    
    const error = await saveSettings({ inventory_categories: updatedCategories });
    if (!error) {
      toast({ title: 'Category Updated', description: `Category has been updated to ${editingInventoryCategoryName}.` });
      setEditingInventoryCategoryIndex(null);
      setEditingInventoryCategoryName('');
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setInventoryCategories(inventoryCategories); // Revert on error
    }
  };

  const handleDeleteInventoryCategory = async (index: number) => {
    const categoryToDelete = inventoryCategories[index];
    
    // Check if any inventory items use this category
    try {
      const { data: itemsUsingCategory, error } = await supabase
        .from('inventory')
        .select('id, name')
        .eq('category', categoryToDelete)
        .eq('is_active', true);
      
      if (!error && itemsUsingCategory && itemsUsingCategory.length > 0) {
        toast({ 
          title: 'Cannot Delete Category', 
          description: `This category is used by ${itemsUsingCategory.length} inventory item(s). Please reassign or delete those items first.`,
          variant: 'destructive' 
        });
        return;
      }
    } catch (err) {
      console.error('Error checking category usage:', err);
      toast({ title: 'Error', description: 'Failed to check category usage.', variant: 'destructive' });
      return;
    }
    
    const updatedCategories = inventoryCategories.filter((_, i) => i !== index);
    setInventoryCategories(updatedCategories);
    
    const error = await saveSettings({ inventory_categories: updatedCategories });
    if (!error) {
      toast({ title: 'Category Deleted', description: `${categoryToDelete} has been removed from inventory categories.` });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setInventoryCategories(inventoryCategories); // Revert on error
    }
  };

  // Inventory units management functions
  const handleAddInventoryUnit = async () => {
    if (!newInventoryUnit.name.trim() || !newInventoryUnit.description.trim()) {
      toast({ title: 'Missing Information', description: 'Please enter unit name and description.', variant: 'destructive' });
      return;
    }
    
    if (inventoryUnits.some(unit => unit.name.toLowerCase() === newInventoryUnit.name.trim().toLowerCase())) {
      toast({ title: 'Unit Exists', description: 'This unit already exists.', variant: 'destructive' });
      return;
    }
    
    const updatedUnits = [...inventoryUnits, { 
      name: newInventoryUnit.name.trim(), 
      type: newInventoryUnit.type, 
      description: newInventoryUnit.description.trim() 
    }];
    setInventoryUnits(updatedUnits);
    
    const error = await saveSettings({ inventory_units: updatedUnits });
    if (!error) {
      toast({ title: 'Unit Added', description: `${newInventoryUnit.name} has been added to inventory units.` });
      setNewInventoryUnit({ name: '', type: 'count', description: '' });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setInventoryUnits(inventoryUnits); // Revert on error
    }
  };

  const handleEditInventoryUnit = async (index: number) => {
    if (!editingInventoryUnit.name.trim() || !editingInventoryUnit.description.trim()) {
      toast({ title: 'Missing Information', description: 'Please enter unit name and description.', variant: 'destructive' });
      return;
    }
    
    // Check if name already exists (excluding current unit)
    if (inventoryUnits.some((unit, i) => i !== index && unit.name.toLowerCase() === editingInventoryUnit.name.trim().toLowerCase())) {
      toast({ title: 'Unit Exists', description: 'This unit name already exists.', variant: 'destructive' });
      return;
    }
    
    const oldUnitName = inventoryUnits[index].name;
    const updatedUnits = [...inventoryUnits];
    updatedUnits[index] = {
      name: editingInventoryUnit.name.trim(),
      type: editingInventoryUnit.type,
      description: editingInventoryUnit.description.trim()
    };
    setInventoryUnits(updatedUnits);
    
    // Update inventory items with old unit name
    try {
      const { data: itemsToUpdate, error: fetchError } = await supabase
        .from('inventory')
        .select('id, unit')
        .eq('unit', oldUnitName);
      
      if (!fetchError && itemsToUpdate && itemsToUpdate.length > 0) {
        for (const item of itemsToUpdate) {
          await supabase
            .from('inventory')
            .update({ unit: editingInventoryUnit.name.trim() })
            .eq('id', item.id);
        }
      }
    } catch (err) {
      console.error('Error updating inventory items:', err);
    }
    
    const error = await saveSettings({ inventory_units: updatedUnits });
    if (!error) {
      toast({ title: 'Unit Updated', description: `Unit has been updated to ${editingInventoryUnit.name}.` });
      setEditingInventoryUnitIndex(null);
      setEditingInventoryUnit({ name: '', type: 'count', description: '' });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setInventoryUnits(inventoryUnits); // Revert on error
    }
  };

  const handleDeleteInventoryUnit = async (index: number) => {
    const unitToDelete = inventoryUnits[index];
    
    // Check if any inventory items use this unit
    try {
      const { data: itemsUsingUnit, error } = await supabase
        .from('inventory')
        .select('id, name')
        .eq('unit', unitToDelete.name)
        .eq('is_active', true);
      
      if (!error && itemsUsingUnit && itemsUsingUnit.length > 0) {
        toast({ 
          title: 'Cannot Delete Unit', 
          description: `This unit is used by ${itemsUsingUnit.length} inventory item(s). Please reassign or delete those items first.`,
          variant: 'destructive' 
        });
        return;
      }
    } catch (err) {
      console.error('Error checking unit usage:', err);
      toast({ title: 'Error', description: 'Failed to check unit usage.', variant: 'destructive' });
      return;
    }
    
    const updatedUnits = inventoryUnits.filter((_, i) => i !== index);
    setInventoryUnits(updatedUnits);
    
    const error = await saveSettings({ inventory_units: updatedUnits });
    if (!error) {
      toast({ title: 'Unit Deleted', description: `${unitToDelete.name} has been removed from inventory units.` });
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setInventoryUnits(inventoryUnits); // Revert on error
    }
  };

  // Simple Ingredient Picker for Sundaes
  const IngredientPicker = ({ 
    recipe, 
    onRecipeChange 
  }: {
    recipe: SundaeIngredient[] | null;
    onRecipeChange: (recipe: SundaeIngredient[]) => void;
  }) => {
    const ingredients = recipe || [];

    const addIngredient = () => {
      const newIngredients = [...ingredients, { name: '', quantity: 1, unit: 'g', category: '' }];
      onRecipeChange(newIngredients);
    };

    const removeIngredient = (index: number) => {
      const newIngredients = ingredients.filter((_, i) => i !== index);
      onRecipeChange(newIngredients);
    };

    const updateIngredient = (index: number, field: keyof SundaeIngredient, value: any) => {
      const newIngredients = [...ingredients];
      newIngredients[index] = { ...newIngredients[index], [field]: value };
      onRecipeChange(newIngredients);
    };

    // When an inventory item is selected, auto-populate unit and category
    const handleIngredientSelect = (index: number, selectedValue: string) => {
      const selectedItem = inventoryItems.find(item => item.name === selectedValue);
      if (selectedItem) {
        const newIngredients = [...ingredients];
        newIngredients[index] = {
          ...newIngredients[index],
          name: selectedItem.name,
          unit: selectedItem.unit,
          category: selectedItem.category
        };
        onRecipeChange(newIngredients);
      } else {
        // If it's a custom value, just update the name
        updateIngredient(index, 'name', selectedValue);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Sundae Recipe</Label>
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="h-4 w-4 mr-2" />
            Add Ingredient
          </Button>
        </div>
        
        {ingredients.length === 0 ? (
          <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            <p>No ingredients added yet.</p>
            <p className="text-sm">Click "Add Ingredient" to start building your sundae recipe.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {ingredients.map((ingredient, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg bg-gray-50">
                <div className="col-span-4">
                  <Select
                    value={ingredient.name}
                    onValueChange={(value) => handleIngredientSelect(index, value)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.id} value={item.name}>
                          {item.name} ({item.available_quantity} {item.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Qty"
                    value={ingredient.quantity || ''}
                    onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div className="col-span-2">
                  <div className="h-9 px-3 py-2 border rounded-md bg-gray-100 text-sm flex items-center">
                    {ingredient.unit || 'Unit'}
                  </div>
                </div>
                <div className="col-span-3">
                  <div className="h-9 px-3 py-2 border rounded-md bg-gray-100 text-sm flex items-center">
                    {ingredient.category || 'Category'}
                  </div>
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeIngredient(index)}
                    className="h-9 w-9 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {ingredients.length > 0 && (
          <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
            <strong>{ingredients.length} ingredient(s)</strong> configured for this sundae.
            <br />
            <span className="text-xs">Unit and category are auto-filled from selected inventory items.</span>
          </div>
        )}
      </div>
    );
  };

  // Supplier management functions
  const handleAddSupplier = async () => {
    if (!newSupplier.name?.trim()) {
      toast({
        title: 'Missing Required Field',
        description: 'Supplier name is required.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase.from('suppliers').insert([{
        ...newSupplier,
        categories: newSupplier.categories || []
      }]);

      if (error) throw error;

      // Refresh suppliers list
      const { data } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers(data || []);

      setNewSupplier({
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        business_type: 'local',
        payment_terms: supplierSettings.default_payment_terms,
        lead_time_days: supplierSettings.default_lead_time_days,
        is_active: true,
        is_preferred: false,
        categories: [],
        country: supplierSettings.default_country
      });
      setShowAddSupplier(false);

      toast({ title: 'Supplier Added', description: `"${newSupplier.name}" has been added successfully.` });
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to add supplier: ${error.message}`, variant: 'destructive' });
    }
  };

  const handleEditSupplier = async () => {
    if (!currentSupplier || !currentSupplier.name?.trim()) {
      toast({
        title: 'Missing Required Field',
        description: 'Supplier name is required.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: currentSupplier.name,
          contact_person: currentSupplier.contact_person,
          email: currentSupplier.email,
          phone: currentSupplier.phone,
          mobile: currentSupplier.mobile,
          website: currentSupplier.website,
          address_line1: currentSupplier.address_line1,
          city: currentSupplier.city,
          state: currentSupplier.state,
          postal_code: currentSupplier.postal_code,
          country: currentSupplier.country,
          business_type: currentSupplier.business_type,
          payment_terms: currentSupplier.payment_terms,
          lead_time_days: currentSupplier.lead_time_days,
          categories: currentSupplier.categories || [],
          is_active: currentSupplier.is_active,
          is_preferred: currentSupplier.is_preferred,
          notes: currentSupplier.notes
        })
        .eq('id', currentSupplier.id);

      if (error) throw error;

      // Refresh suppliers list
      const { data } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers(data || []);

      setCurrentSupplier(null);
      setShowEditSupplier(false);

      toast({ title: 'Supplier Updated', description: `"${currentSupplier.name}" has been updated successfully.` });
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to update supplier: ${error.message}`, variant: 'destructive' });
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    try {
      // Check if supplier is used in inventory
      const { data: inventoryItems, error: checkError } = await supabase
        .from('inventory')
        .select('id, name')
        .eq('supplier_id', supplierId)
        .limit(1);

      if (checkError) throw checkError;

      if (inventoryItems && inventoryItems.length > 0) {
        toast({
          title: 'Cannot Delete Supplier',
          description: 'This supplier is used by inventory items. Please reassign or remove those items first.',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
      if (error) throw error;

      // Refresh suppliers list
      const { data } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers(data || []);

      toast({ title: 'Supplier Deleted', description: 'Supplier has been removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: `Failed to delete supplier: ${error.message}`, variant: 'destructive' });
    }
  };

  const handleSaveSupplierSettings = async () => {
    try {
      const error = await saveSettings();
      if (!error) {
        toast({
          title: 'Supplier Settings Updated',
          description: 'Your supplier management settings have been saved.'
        });
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to save supplier settings: ${error.message}`,
        variant: 'destructive'
      });
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

  const handleSaveInvoiceLayout = async () => {
    try {
      let logoUrl = invoiceLayout.logoUrl;
      
      // Upload new logo if selected
      if (invoiceLogoFile) {
        const fileExt = invoiceLogoFile.name.split('.').pop();
        const fileName = `invoice-logo-${Date.now()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('branding')
          .upload(fileName, invoiceLogoFile, { upsert: true });
          
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from('branding')
            .getPublicUrl(fileName);
          logoUrl = publicUrl;
        }
      }
      
      const newLayout = { ...invoiceLayout, logoUrl };
      setInvoiceLayout(newLayout);
      
      // Save to settings table
      const error = await saveSettings({ invoice_layout: newLayout });
      
      if (!error) {
        toast({ 
          title: 'Invoice Layout Saved', 
          description: 'Invoice layout settings have been updated successfully.' 
        });
        setInvoiceLogoFile(null); // Clear file input
      } else {
        toast({ 
          title: 'Error', 
          description: error.message, 
          variant: 'destructive' 
        });
      }
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to save invoice layout.', 
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
        <TabsList className="grid w-full md:w-[1000px] grid-cols-7">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="business">Business</TabsTrigger>}
          {isAdmin && <TabsTrigger value="receipts">Receipts</TabsTrigger>}
          {isAdmin && <TabsTrigger value="staff">Staff</TabsTrigger>}
          {isAdmin && <TabsTrigger value="menu">Menu Items</TabsTrigger>}
          {isAdmin && <TabsTrigger value="inventory">Inventory</TabsTrigger>}
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
              
              {/* Business Profile Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Business Profile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Business Name</Label>
                    <Input
                      id="legalName"
                      value={businessProfile.legalBusinessName}
                      onChange={(e) => setBusinessProfile({ ...businessProfile, legalBusinessName: e.target.value })}
                      placeholder="Creamello Ice Cream Ltd."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tradingAs">Trading As</Label>
                    <Input
                      id="tradingAs"
                      value={businessProfile.tradingAs}
                      onChange={(e) => setBusinessProfile({ ...businessProfile, tradingAs: e.target.value })}
                      placeholder="Creamello"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type</Label>
                    <Select value={businessProfile.businessType} onValueChange={(v) => setBusinessProfile({ ...businessProfile, businessType: v })}>
                      <SelectTrigger id="businessType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                        <SelectItem value="partnership">Partnership</SelectItem>
                        <SelectItem value="corporation">Corporation</SelectItem>
                        <SelectItem value="llc">LLC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={businessProfile.industryType}
                      onChange={(e) => setBusinessProfile({ ...businessProfile, industryType: e.target.value })}
                      placeholder="Food Service"
                    />
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
              <CardContent className="space-y-6">
                {/* Category Management Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Menu Categories</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowCategoryManager(true)}
                    >
                                             <SettingsIcon className="mr-2 h-4 w-4" /> Manage Categories
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {menuCategories.map((category, index) => (
                      <Badge key={index} variant="secondary" className="px-3 py-1">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
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
                    <div className="flex gap-2">
                      <Select 
                        value={newMenuItem.category} 
                        onValueChange={v => setNewMenuItem({ 
                          ...newMenuItem, 
                          category: v,
                          recipe: v === 'Sundaes' ? newMenuItem.recipe : null 
                        })}
                      >
                        <SelectTrigger id="item-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {menuCategories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowCategoryManager(true)}
                        title="Manage Categories"
                      >
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                    </div>
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
                  
                  {/* Ingredient Picker - only show for Sundaes category */}
                  {newMenuItem.category === 'Sundaes' && (
                    <div className="border-t pt-4">
                      <IngredientPicker
                        recipe={newMenuItem.recipe}
                        onRecipeChange={(recipe) => setNewMenuItem({ ...newMenuItem, recipe })}
                      />
                    </div>
                  )}
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
                      <div className="flex gap-2">
                        <Select 
                          value={currentMenuItem.category} 
                          onValueChange={v => setCurrentMenuItem({ 
                            ...currentMenuItem, 
                            category: v,
                            recipe: v === 'Sundaes' ? currentMenuItem.recipe : null 
                          })}
                        >
                          <SelectTrigger id="edit-item-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {menuCategories.map(category => (
                              <SelectItem key={category} value={category}>{category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowCategoryManager(true)}
                          title="Manage Categories"
                        >
                          <SettingsIcon className="h-4 w-4" />
                        </Button>
                      </div>
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
                    
                    {/* Ingredient Picker - only show for Sundaes category */}
                    {currentMenuItem.category === 'Sundaes' && (
                      <div className="border-t pt-4">
                        <IngredientPicker
                          recipe={currentMenuItem.recipe}
                          onRecipeChange={(recipe) => setCurrentMenuItem({ ...currentMenuItem, recipe })}
                        />
                      </div>
                    )}
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
            
            {/* Category Manager Dialog */}
            <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Manage Menu Categories</DialogTitle>
                  <DialogDescription>
                    Add, edit, or remove menu categories for your items.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Add New Category */}
                  <div className="space-y-2">
                    <Label htmlFor="new-category">Add New Category</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="new-category"
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                      />
                      <Button onClick={handleAddCategory} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Existing Categories */}
                  <div className="space-y-2">
                    <Label>Existing Categories</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {menuCategories.map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          {editingCategoryIndex === index ? (
                            <div className="flex gap-2 flex-1">
                              <Input 
                                value={editingCategoryName}
                                onChange={e => setEditingCategoryName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleEditCategory(index);
                                  if (e.key === 'Escape') {
                                    setEditingCategoryIndex(null);
                                    setEditingCategoryName('');
                                  }
                                }}
                                autoFocus
                              />
                              <Button onClick={() => handleEditCategory(index)} size="sm">
                                Save
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditingCategoryIndex(null);
                                  setEditingCategoryName('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1">{category}</span>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingCategoryIndex(index);
                                    setEditingCategoryName(category);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteCategory(index)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowCategoryManager(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="inventory">
            <div className="space-y-6">
              {/* Inventory Categories Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Categories</CardTitle>
                  <CardDescription>
                    Configure categories for organizing your inventory items.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Current Categories</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowInventoryCategoryManager(true)}
                    >
                      <SettingsIcon className="mr-2 h-4 w-4" /> Manage Categories
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {inventoryCategories.map((category, index) => (
                      <Badge key={index} variant="secondary" className="px-3 py-1 justify-center">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Inventory Units Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Measurement Units</CardTitle>
                  <CardDescription>
                    Configure units of measurement for your inventory items.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Current Units</h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowInventoryUnitManager(true)}
                    >
                      <SettingsIcon className="mr-2 h-4 w-4" /> Manage Units
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {['weight', 'volume', 'count', 'container'].map(type => (
                      <div key={type} className="space-y-2">
                        <h4 className="font-medium capitalize text-sm text-muted-foreground">{type} Units</h4>
                        <div className="flex flex-wrap gap-2">
                          {inventoryUnits.filter(unit => unit.type === type).map((unit, index) => (
                            <Badge key={index} variant="outline" className="px-3 py-1">
                              <span className="font-medium">{unit.name}</span>
                              <span className="ml-2 text-muted-foreground">({unit.description})</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Layout</CardTitle>
                  <CardDescription>Customize your invoice print layout and branding.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoice-business-name">Business Name</Label>
                        <Input 
                          id="invoice-business-name"
                          value={invoiceLayout.businessName} 
                          onChange={e => setInvoiceLayout({ ...invoiceLayout, businessName: e.target.value })}
                          placeholder="Your Business Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-address">Address</Label>
                        <Input 
                          id="invoice-address"
                          value={invoiceLayout.address} 
                          onChange={e => setInvoiceLayout({ ...invoiceLayout, address: e.target.value })}
                          placeholder="123 Main Street, City, Country"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-phone">Phone</Label>
                        <Input 
                          id="invoice-phone"
                          value={invoiceLayout.phone} 
                          onChange={e => setInvoiceLayout({ ...invoiceLayout, phone: e.target.value })}
                          placeholder="+233 123 456 789"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-email">Email</Label>
                        <Input 
                          id="invoice-email"
                          type="email"
                          value={invoiceLayout.email} 
                          onChange={e => setInvoiceLayout({ ...invoiceLayout, email: e.target.value })}
                          placeholder="info@yourbusiness.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-logo">Logo</Label>
                        <Input 
                          id="invoice-logo"
                          type="file" 
                          accept="image/*" 
                          onChange={e => setInvoiceLogoFile(e.target.files?.[0] || null)} 
                        />
                        {invoiceLayout.logoUrl && (
                          <div className="mt-2">
                            <img src={invoiceLayout.logoUrl} alt="Current Logo" className="h-16 border rounded" />
                            <p className="text-xs text-muted-foreground mt-1">Current logo</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invoice-footer">Footer Text</Label>
                        <Textarea 
                          id="invoice-footer"
                          value={invoiceLayout.footer} 
                          onChange={e => setInvoiceLayout({ ...invoiceLayout, footer: e.target.value })}
                          placeholder="Thank you for your business!"
                          rows={3}
                        />
                      </div>
                    </div>
                    
                    {/* Professional Invoice Preview */}
                    <div className="border rounded-lg p-4 bg-white shadow-sm">
                      <h4 className="font-semibold mb-4 text-center">Invoice Preview</h4>
                      <div className="bg-white border rounded p-4 text-sm" style={{ minHeight: '400px', fontFamily: 'Arial, sans-serif' }}>
                        {/* Header */}
                        <div className="border-b-2 border-gray-800 pb-4 mb-4 text-center">
                          {invoiceLayout.logoUrl && (
                            <img 
                              src={invoiceLayout.logoUrl} 
                              alt="Logo" 
                              className="h-12 mx-auto mb-2 object-contain" 
                            />
                          )}
                          <h2 className="text-2xl font-bold tracking-wider mb-2">INVOICE</h2>
                          <div className="font-semibold text-base text-gray-800">
                            {invoiceLayout.businessName || 'Your Business Name'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {invoiceLayout.address || '123 Main Street, City, Country'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {invoiceLayout.phone || '+233 123 456 789'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {invoiceLayout.email || 'info@yourbusiness.com'}
                          </div>
                        </div>
                        
                        {/* Invoice Details */}
                        <div className="flex justify-between mb-4">
                          <div>
                            <div className="font-semibold">Bill To:</div>
                            <div className="text-gray-700">Sample Customer</div>
                            <div className="text-gray-600 text-sm">customer@email.com</div>
                          </div>
                          <div className="text-right">
                            <div><span className="font-semibold">Invoice #:</span> INV-00001</div>
                            <div><span className="font-semibold">Issue Date:</span> {new Date().toLocaleDateString()}</div>
                            <div><span className="font-semibold">Due Date:</span> {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</div>
                            <div><span className="font-semibold">Status:</span> <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Unpaid</span></div>
                          </div>
                        </div>
                        
                        {/* Sample Items */}
                        <div className="mb-4">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 text-sm font-semibold">Description</th>
                                <th className="text-right py-2 text-sm font-semibold">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b">
                                <td className="py-2 text-sm">Ice Cream Service</td>
                                <td className="text-right py-2 text-sm">GHS 150.00</td>
                              </tr>
                              <tr className="border-b">
                                <td className="py-2 text-sm">Additional Toppings</td>
                                <td className="text-right py-2 text-sm">GHS 25.00</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        
                        {/* Total */}
                        <div className="flex justify-end mb-4">
                          <div className="text-right">
                            <div className="text-lg font-bold border-t pt-2">
                              <span>Total: GHS 175.00</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="border-t pt-4 mt-4 text-center text-sm text-gray-600">
                          {invoiceLayout.footer || 'Thank you for your business!'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={handleSaveInvoiceLayout}>Save Invoice Layout</Button>
                </CardFooter>
              </Card>
            </div>
            
            {/* Inventory Category Manager Dialog */}
            <Dialog open={showInventoryCategoryManager} onOpenChange={setShowInventoryCategoryManager}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Manage Inventory Categories</DialogTitle>
                  <DialogDescription>
                    Add, edit, or remove categories for organizing inventory items.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Add New Category */}
                  <div className="space-y-2">
                    <Label htmlFor="new-inventory-category">Add New Category</Label>
                    <div className="flex gap-2">
                      <Input 
                        id="new-inventory-category"
                        placeholder="Category name"
                        value={newInventoryCategoryName}
                        onChange={e => setNewInventoryCategoryName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddInventoryCategory()}
                      />
                      <Button onClick={handleAddInventoryCategory} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Existing Categories */}
                  <div className="space-y-2">
                    <Label>Existing Categories</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {inventoryCategories.map((category, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          {editingInventoryCategoryIndex === index ? (
                            <div className="flex gap-2 flex-1">
                              <Input 
                                value={editingInventoryCategoryName}
                                onChange={e => setEditingInventoryCategoryName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleEditInventoryCategory(index);
                                  if (e.key === 'Escape') {
                                    setEditingInventoryCategoryIndex(null);
                                    setEditingInventoryCategoryName('');
                                  }
                                }}
                                autoFocus
                              />
                              <Button onClick={() => handleEditInventoryCategory(index)} size="sm">
                                Save
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEditingInventoryCategoryIndex(null);
                                  setEditingInventoryCategoryName('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1">{category}</span>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingInventoryCategoryIndex(index);
                                    setEditingInventoryCategoryName(category);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteInventoryCategory(index)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowInventoryCategoryManager(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Inventory Units Manager Dialog */}
            <Dialog open={showInventoryUnitManager} onOpenChange={setShowInventoryUnitManager}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Manage Measurement Units</DialogTitle>
                  <DialogDescription>
                    Add, edit, or remove units of measurement for inventory items.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Add New Unit */}
                  <div className="space-y-3">
                    <Label>Add New Unit</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="new-unit-name" className="text-sm">Unit Name</Label>
                        <Input 
                          id="new-unit-name"
                          placeholder="e.g., tons"
                          value={newInventoryUnit.name}
                          onChange={e => setNewInventoryUnit({ ...newInventoryUnit, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-unit-type" className="text-sm">Type</Label>
                        <Select 
                          value={newInventoryUnit.type} 
                          onValueChange={v => setNewInventoryUnit({ ...newInventoryUnit, type: v as any })}
                        >
                          <SelectTrigger id="new-unit-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weight">Weight</SelectItem>
                            <SelectItem value="volume">Volume</SelectItem>
                            <SelectItem value="count">Count</SelectItem>
                            <SelectItem value="container">Container</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="new-unit-description" className="text-sm">Description</Label>
                      <Input 
                        id="new-unit-description"
                        placeholder="e.g., Metric tons"
                        value={newInventoryUnit.description}
                        onChange={e => setNewInventoryUnit({ ...newInventoryUnit, description: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleAddInventoryUnit()}
                      />
                    </div>
                    <Button onClick={handleAddInventoryUnit} size="sm" className="w-full">
                      <Plus className="mr-2 h-4 w-4" /> Add Unit
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  {/* Existing Units */}
                  <div className="space-y-2">
                    <Label>Existing Units</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {inventoryUnits.map((unit, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded">
                          {editingInventoryUnitIndex === index ? (
                            <div className="space-y-2 flex-1">
                              <div className="grid grid-cols-2 gap-2">
                                <Input 
                                  placeholder="Unit name"
                                  value={editingInventoryUnit.name}
                                  onChange={e => setEditingInventoryUnit({ ...editingInventoryUnit, name: e.target.value })}
                                />
                                <Select 
                                  value={editingInventoryUnit.type} 
                                  onValueChange={v => setEditingInventoryUnit({ ...editingInventoryUnit, type: v as any })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="weight">Weight</SelectItem>
                                    <SelectItem value="volume">Volume</SelectItem>
                                    <SelectItem value="count">Count</SelectItem>
                                    <SelectItem value="container">Container</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input 
                                placeholder="Description"
                                value={editingInventoryUnit.description}
                                onChange={e => setEditingInventoryUnit({ ...editingInventoryUnit, description: e.target.value })}
                              />
                              <div className="flex gap-2">
                                <Button onClick={() => handleEditInventoryUnit(index)} size="sm">
                                  Save
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingInventoryUnitIndex(null);
                                    setEditingInventoryUnit({ name: '', type: 'count', description: '' });
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <div className="font-medium">{unit.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {unit.description} • {unit.type}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingInventoryUnitIndex(index);
                                    setEditingInventoryUnit(unit);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteInventoryUnit(index)}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowInventoryUnitManager(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Supplier Management Section */}
            <Card>
              <CardHeader>
                <CardTitle>Supplier Management</CardTitle>
                <CardDescription>
                  Manage your suppliers and supplier configuration settings.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Supplier Settings Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Supplier Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="default_payment_terms">Default Payment Terms</Label>
                      <Select 
                        value={supplierSettings.default_payment_terms} 
                        onValueChange={v => setSupplierSettings({ ...supplierSettings, default_payment_terms: v })}
                      >
                        <SelectTrigger id="default_payment_terms">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cod">Cash on Delivery</SelectItem>
                          <SelectItem value="net15">Net 15 Days</SelectItem>
                          <SelectItem value="net30">Net 30 Days</SelectItem>
                          <SelectItem value="net60">Net 60 Days</SelectItem>
                          <SelectItem value="prepaid">Prepaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="default_lead_time">Default Lead Time (Days)</Label>
                      <Input
                        id="default_lead_time"
                        type="number"
                        min="1"
                        value={supplierSettings.default_lead_time_days}
                        onChange={e => setSupplierSettings({ ...supplierSettings, default_lead_time_days: Number(e.target.value) })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="supplier_code_prefix">Supplier Code Prefix</Label>
                      <Input
                        id="supplier_code_prefix"
                        value={supplierSettings.supplier_code_prefix}
                        onChange={e => setSupplierSettings({ ...supplierSettings, supplier_code_prefix: e.target.value })}
                        placeholder="SUP"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="default_country">Default Country</Label>
                      <Input
                        id="default_country"
                        value={supplierSettings.default_country}
                        onChange={e => setSupplierSettings({ ...supplierSettings, default_country: e.target.value })}
                        placeholder="Ghana"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="auto_generate_codes"
                      checked={supplierSettings.auto_generate_supplier_codes}
                      onChange={e => setSupplierSettings({ ...supplierSettings, auto_generate_supplier_codes: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="auto_generate_codes">Auto-generate supplier codes</Label>
                  </div>
                  
                  <Button onClick={handleSaveSupplierSettings} className="w-full md:w-auto">
                    Save Supplier Settings
                  </Button>
                </div>

                {/* Suppliers List Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold border-b pb-2">Suppliers</h3>
                    <Button onClick={() => setShowAddSupplier(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Supplier
                    </Button>
                  </div>
                  
                  <div className="grid gap-4">
                    {suppliers.map((supplier) => (
                      <div key={supplier.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{supplier.name}</h4>
                              <Badge variant="outline">{supplier.code}</Badge>
                              {supplier.is_preferred && (
                                <Badge className="bg-yellow-100 text-yellow-800">Preferred</Badge>
                              )}
                              {!supplier.is_active && (
                                <Badge variant="destructive">Inactive</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              {supplier.contact_person && <div>Contact: {supplier.contact_person}</div>}
                              {supplier.phone && <div>Phone: {supplier.phone}</div>}
                              {supplier.email && <div>Email: {supplier.email}</div>}
                              {supplier.business_type && <div>Type: {supplier.business_type}</div>}
                              {supplier.payment_terms && <div>Payment: {supplier.payment_terms}</div>}
                              {supplier.lead_time_days && <div>Lead Time: {supplier.lead_time_days} days</div>}
                            </div>
                            {supplier.categories && supplier.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {supplier.categories.map((category, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {category}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setCurrentSupplier(supplier);
                                setShowEditSupplier(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {suppliers.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No suppliers configured yet. Add your first supplier to get started.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add Supplier Dialog */}
            <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Supplier</DialogTitle>
                  <DialogDescription>
                    Add a new supplier to your database.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplier_name">Supplier Name *</Label>
                      <Input
                        id="supplier_name"
                        value={newSupplier.name}
                        onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                        placeholder="Enter supplier name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_person">Contact Person</Label>
                      <Input
                        id="contact_person"
                        value={newSupplier.contact_person}
                        onChange={e => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                        placeholder="Contact person name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier_email">Email</Label>
                      <Input
                        id="supplier_email"
                        type="email"
                        value={newSupplier.email}
                        onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                        placeholder="supplier@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier_phone">Phone</Label>
                      <Input
                        id="supplier_phone"
                        value={newSupplier.phone}
                        onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business_type">Business Type</Label>
                      <Select 
                        value={newSupplier.business_type} 
                        onValueChange={v => setNewSupplier({ ...newSupplier, business_type: v })}
                      >
                        <SelectTrigger id="business_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Local</SelectItem>
                          <SelectItem value="wholesaler">Wholesaler</SelectItem>
                          <SelectItem value="manufacturer">Manufacturer</SelectItem>
                          <SelectItem value="distributor">Distributor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_terms">Payment Terms</Label>
                      <Select 
                        value={newSupplier.payment_terms} 
                        onValueChange={v => setNewSupplier({ ...newSupplier, payment_terms: v })}
                      >
                        <SelectTrigger id="payment_terms">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cod">Cash on Delivery</SelectItem>
                          <SelectItem value="net15">Net 15 Days</SelectItem>
                          <SelectItem value="net30">Net 30 Days</SelectItem>
                          <SelectItem value="net60">Net 60 Days</SelectItem>
                          <SelectItem value="prepaid">Prepaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_preferred"
                        checked={newSupplier.is_preferred}
                        onChange={e => setNewSupplier({ ...newSupplier, is_preferred: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="is_preferred">Preferred Supplier</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={newSupplier.is_active}
                        onChange={e => setNewSupplier({ ...newSupplier, is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="is_active">Active</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddSupplier(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddSupplier}>
                    Add Supplier
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Supplier Dialog */}
            <Dialog open={showEditSupplier} onOpenChange={setShowEditSupplier}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Supplier</DialogTitle>
                  <DialogDescription>
                    Update supplier information.
                  </DialogDescription>
                </DialogHeader>
                {currentSupplier && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit_supplier_name">Supplier Name *</Label>
                        <Input
                          id="edit_supplier_name"
                          value={currentSupplier.name}
                          onChange={e => setCurrentSupplier({ ...currentSupplier, name: e.target.value })}
                          placeholder="Enter supplier name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_contact_person">Contact Person</Label>
                        <Input
                          id="edit_contact_person"
                          value={currentSupplier.contact_person || ''}
                          onChange={e => setCurrentSupplier({ ...currentSupplier, contact_person: e.target.value })}
                          placeholder="Contact person name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_supplier_email">Email</Label>
                        <Input
                          id="edit_supplier_email"
                          type="email"
                          value={currentSupplier.email || ''}
                          onChange={e => setCurrentSupplier({ ...currentSupplier, email: e.target.value })}
                          placeholder="supplier@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_supplier_phone">Phone</Label>
                        <Input
                          id="edit_supplier_phone"
                          value={currentSupplier.phone || ''}
                          onChange={e => setCurrentSupplier({ ...currentSupplier, phone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_business_type">Business Type</Label>
                        <Select 
                          value={currentSupplier.business_type || 'local'} 
                          onValueChange={v => setCurrentSupplier({ ...currentSupplier, business_type: v })}
                        >
                          <SelectTrigger id="edit_business_type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="wholesaler">Wholesaler</SelectItem>
                            <SelectItem value="manufacturer">Manufacturer</SelectItem>
                            <SelectItem value="distributor">Distributor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_payment_terms">Payment Terms</Label>
                        <Select 
                          value={currentSupplier.payment_terms || 'net30'} 
                          onValueChange={v => setCurrentSupplier({ ...currentSupplier, payment_terms: v })}
                        >
                          <SelectTrigger id="edit_payment_terms">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cod">Cash on Delivery</SelectItem>
                            <SelectItem value="net15">Net 15 Days</SelectItem>
                            <SelectItem value="net30">Net 30 Days</SelectItem>
                            <SelectItem value="net60">Net 60 Days</SelectItem>
                            <SelectItem value="prepaid">Prepaid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit_is_preferred"
                          checked={currentSupplier.is_preferred}
                          onChange={e => setCurrentSupplier({ ...currentSupplier, is_preferred: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="edit_is_preferred">Preferred Supplier</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit_is_active"
                          checked={currentSupplier.is_active}
                          onChange={e => setCurrentSupplier({ ...currentSupplier, is_active: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor="edit_is_active">Active</Label>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowEditSupplier(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditSupplier}>
                    Update Supplier
                  </Button>
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
