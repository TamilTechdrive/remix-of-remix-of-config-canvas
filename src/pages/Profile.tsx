import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  User, Mail, Shield, Key, Fingerprint, Clock,
  Save, Camera, Monitor, Smartphone, Globe,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

const trustedDevices = [
  { name: 'Chrome on MacOS', type: 'desktop', lastUsed: '2 min ago', current: true },
  { name: 'Firefox on Windows', type: 'desktop', lastUsed: '3 days ago', current: false },
  { name: 'Safari on iPhone', type: 'mobile', lastUsed: '1 week ago', current: false },
];

const Profile = () => {
  const { user, updateProfile, isDemoMode } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSaveProfile = () => {
    updateProfile({ displayName });
    toast.success('Profile updated');
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (isDemoMode) {
      toast.info('Password change not available in demo mode');
      return;
    }
    toast.success('Password changed successfully');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="w-6 h-6 text-muted-foreground" />
          User Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Card */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-2xl font-bold text-primary">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-secondary/80 transition-colors">
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{user?.displayName}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-1.5 mt-2">
                {user?.roles.map(r => (
                  <Badge key={r} variant="secondary" className="text-xs capitalize">{r}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="general" className="gap-1.5"><User className="w-3.5 h-3.5" /> General</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="devices" className="gap-1.5"><Fingerprint className="w-3.5 h-3.5" /> Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={email} readOnly className="bg-secondary/50 pl-10 opacity-60" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Username</Label>
                  <Input value={user?.username || ''} readOnly className="bg-secondary/50 opacity-60" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">User ID</Label>
                  <Input value={user?.id || ''} readOnly className="bg-secondary/50 opacity-60 font-mono text-xs" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} className="gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Key className="w-4 h-4 text-accent" /> Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user?.permissions.map(p => (
                  <Badge key={p} variant="outline" className="text-xs font-mono">{p}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-secondary/50" />
              </div>
              <Button onClick={handleChangePassword} variant="outline" className="gap-2">
                <Key className="w-4 h-4" /> Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Trusted Devices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {trustedDevices.map((device, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    {device.type === 'mobile' ? (
                      <Smartphone className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{device.name}</p>
                      {device.current && <Badge className="bg-primary/20 text-primary text-[9px]">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last used: {device.lastUsed}
                    </p>
                  </div>
                  {!device.current && (
                    <Button variant="outline" size="sm" className="text-destructive text-xs">Revoke</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
