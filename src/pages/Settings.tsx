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
    }
  }, [isAdmin]);

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
    const { error } = await supabase.from('staff').insert([{ name: newStaff.name, pin: newStaff.pin, role: newStaff.role }]);
    if (!error) {
      toast({ title: 'Staff Added', description: `${newStaff.name} added as ${newStaff.role}.` });
      setShowAddStaff(false);
      setNewStaff({ name: '', pin: '', role: 'staff' });
      // Refresh staff list
      const { data } = await supabase.from('staff').select('id, name, role, pin');
      setStaffList(data || []);
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
        <TabsList className="grid w-full md:w-[400px] grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          {isAdmin && <TabsTrigger value="staff">Staff</TabsTrigger>}
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
                          <td className="px-4 py-2 font-mono tracking-wider">{s.pin}</td>
                        </tr>
                      ))}
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
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Settings;
