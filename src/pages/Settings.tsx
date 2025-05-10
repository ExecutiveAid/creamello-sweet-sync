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
import { Pencil, Trash2, Plus, Clock, Calendar } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, differenceInMinutes, addDays, startOfWeek, endOfWeek } from 'date-fns';

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

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('*').limit(1).single();
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
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('id, name, role, pin');
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
    }
  }, [isAdmin, selectedWeek]);
  
  // Function to fetch staff attendance data for the selected week
  const fetchStaffAttendance = async () => {
    try {
      // Calculate the start and end dates for the selected week
      const weekStart = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
      
      // Format dates for query
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      // Fetch attendance records for the selected week
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('id, staff_id, login_time, logout_time')
        .gte('login_time', `${startDate}T00:00:00`)
        .lte('login_time', `${endDate}T23:59:59`)
        .order('login_time', { ascending: false });
        
      if (error) {
        console.error('Error fetching staff attendance:', error);
        return;
      }
      
      // Add staff names to the attendance records
      const attendanceWithNames = await Promise.all(
        (data || []).map(async (record) => {
          const { data: staffData } = await supabase
            .from('staff')
            .select('name')
            .eq('id', record.staff_id)
            .single();
            
          // Calculate total minutes worked if there's a logout time
          let totalMinutes = null;
          if (record.logout_time) {
            totalMinutes = differenceInMinutes(
              new Date(record.logout_time),
              new Date(record.login_time)
            );
          }
          
          return {
            ...record,
            staff_name: staffData?.name || 'Unknown',
            total_minutes: totalMinutes
          };
        })
      );
      
      setStaffAttendance(attendanceWithNames);
      
      // Calculate daily hours per staff member
      const hours: Record<string, any> = {};
      
      attendanceWithNames.forEach(record => {
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
      
    } catch (err) {
      console.error('Error processing attendance data:', err);
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
      ...overrides,
    };
    const { error } = await supabase.from('settings').upsert(upsertData, { onConflict: 'id' });
    return error;
  };

  const handleSaveProfile = async () => {
    const error = await saveSettings();
    if (!error) {
      toast({
        title: 'Profile Updated',
        description: 'Your profile settings have been saved.'
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
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
    const error = await saveSettings();
    if (!error) {
      toast({
        title: 'System Settings Updated',
        description: 'Your system settings have been saved.'
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
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
    
    // In a production app, you would use a proper password hashing library
    // For now, we'll just store the PIN as-is, but mask it in the UI
    const { error } = await supabase.from('staff').insert([{ 
      name: newStaff.name, 
      pin: newStaff.pin, 
      role: newStaff.role 
    }]);
    
    if (!error) {
      toast({ 
        title: 'Staff Added', 
        description: `${newStaff.name} added as ${newStaff.role} with PIN: ${displayPin}` 
      });
      setShowAddStaff(false);
      setNewStaff({ name: '', pin: '', role: 'staff' });
      // Refresh staff list
      const { data } = await supabase.from('staff').select('id, name, role, pin');
      setStaffList(data || []);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          {isAdmin && <TabsTrigger value="staff">Staff</TabsTrigger>}
          {isAdmin && <TabsTrigger value="menu">Menu Items</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Update your shop information and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shop-name">Shop Name</Label>
                <Input
                  id="shop-name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
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
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile}>Save Changes</Button>
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
        
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure application behavior and system preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto Refresh Dashboard</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh dashboard data every 5 minutes
                  </p>
                </div>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveSystem}>Save Settings</Button>
            </CardFooter>
          </Card>
        </TabsContent>

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
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((s) => (
                        <tr key={s.id} className="even:bg-muted/50">
                          <td className="px-4 py-2">{s.name}</td>
                          <td className="px-4 py-2 capitalize">{s.role}</td>
                          <td className="px-4 py-2 font-mono tracking-wider">{'*'.repeat(s.pin.length)}</td>
                        </tr>
                      ))}
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
