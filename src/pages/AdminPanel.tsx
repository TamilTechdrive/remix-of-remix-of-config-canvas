import { useState } from 'react';
import {
  Shield, Users, Lock, AlertTriangle, Activity, Eye,
  Ban, CheckCircle2, Clock, Fingerprint, Globe, Key,
  RefreshCw, Search, MoreVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const securityMetrics = [
  { label: 'Failed Logins (24h)', value: '23', icon: Lock, color: 'text-destructive', bg: 'bg-destructive/10' },
  { label: 'Active Sessions', value: '18', icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
  { label: 'Locked Accounts', value: '2', icon: Ban, color: 'text-node-group', bg: 'bg-node-group/10' },
  { label: 'New Devices', value: '5', icon: Fingerprint, color: 'text-accent', bg: 'bg-accent/10' },
];

const users = [
  { id: '1', name: 'Demo Admin', email: 'admin@configflow.dev', role: 'admin', status: 'active', lastLogin: '2 min ago', devices: 3, failedAttempts: 0 },
  { id: '2', name: 'Jane Editor', email: 'jane@configflow.dev', role: 'editor', status: 'active', lastLogin: '1 hour ago', devices: 2, failedAttempts: 1 },
  { id: '3', name: 'Bob Viewer', email: 'bob@configflow.dev', role: 'viewer', status: 'active', lastLogin: '3 days ago', devices: 1, failedAttempts: 0 },
  { id: '4', name: 'Charlie Test', email: 'charlie@test.dev', role: 'editor', status: 'locked', lastLogin: '1 week ago', devices: 2, failedAttempts: 5 },
  { id: '5', name: 'Eve Hacker', email: 'eve@suspicious.dev', role: 'viewer', status: 'locked', lastLogin: 'never', devices: 0, failedAttempts: 12 },
];

const auditLogs = [
  { event: 'LOGIN_SUCCESS', user: 'admin@configflow.dev', ip: '192.168.1.1', time: '2 min ago', severity: 'info' },
  { event: 'CONFIG_UPDATE', user: 'admin@configflow.dev', ip: '192.168.1.1', time: '15 min ago', severity: 'info' },
  { event: 'LOGIN_FAILED', user: 'eve@suspicious.dev', ip: '103.45.67.89', time: '30 min ago', severity: 'warning' },
  { event: 'ACCOUNT_LOCKED', user: 'charlie@test.dev', ip: '10.0.0.55', time: '1 hour ago', severity: 'critical' },
  { event: 'ROLE_CHANGED', user: 'jane@configflow.dev', ip: '192.168.1.5', time: '2 hours ago', severity: 'warning' },
  { event: 'TOKEN_REFRESH', user: 'bob@configflow.dev', ip: '172.16.0.1', time: '3 hours ago', severity: 'info' },
  { event: 'CONFIG_DELETE', user: 'admin@configflow.dev', ip: '192.168.1.1', time: '5 hours ago', severity: 'warning' },
  { event: 'LOGIN_FAILED', user: 'unknown@attacker.com', ip: '45.33.22.11', time: '6 hours ago', severity: 'critical' },
];

const AdminPanel = () => {
  const [userSearch, setUserSearch] = useState('');

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-accent" />
          Admin & Security Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor security events, manage users, and review audit logs</p>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {securityMetrics.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-3.5 h-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><Eye className="w-3.5 h-3.5" /> Audit Logs</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Security</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-10 bg-card" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 text-[10px] text-muted-foreground uppercase tracking-wider p-3 border-b border-border">
                <span className="col-span-2">User</span><span>Role</span><span>Status</span><span>Last Login</span><span>Devices</span><span>Actions</span>
              </div>
              {filteredUsers.map(user => (
                <div key={user.id} className="grid grid-cols-7 items-center p-3 border-b border-border/50 hover:bg-secondary/30 transition-colors text-sm">
                  <div className="col-span-2 min-w-0">
                    <p className="font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] w-fit capitalize">{user.role}</Badge>
                  <Badge className={`text-[10px] w-fit ${user.status === 'active' ? 'bg-node-module/20 text-node-module' : 'bg-destructive/20 text-destructive'}`}>
                    {user.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{user.lastLogin}</span>
                  <span className="text-xs text-muted-foreground">{user.devices}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="w-3.5 h-3.5 mr-2" /> View Details</DropdownMenuItem>
                      <DropdownMenuItem><Key className="w-3.5 h-3.5 mr-2" /> Change Role</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {user.status === 'locked' ? (
                        <DropdownMenuItem><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Unlock Account</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem className="text-destructive"><Ban className="w-3.5 h-3.5 mr-2" /> Lock Account</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Audit Log Stream</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {auditLogs.map((log, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                  log.severity === 'critical' ? 'border-destructive/30 bg-destructive/5' :
                  log.severity === 'warning' ? 'border-node-group/30 bg-node-group/5' :
                  'border-border bg-card'
                }`}>
                  {log.severity === 'critical' ? (
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  ) : log.severity === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-node-group shrink-0" />
                  ) : (
                    <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground font-mono text-xs">{log.event}</p>
                    <p className="text-xs text-muted-foreground">{log.user}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                    <Globe className="w-3 h-3" /> {log.ip}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" /> {log.time}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Security Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Password Hashing', value: 'Argon2id', status: 'active' },
                  { label: 'Token Rotation', value: 'JWT 15m / Refresh 7d', status: 'active' },
                  { label: 'Rate Limiting', value: '3-tier (100/50/10)', status: 'active' },
                  { label: 'CSRF Protection', value: 'Double-Submit Cookie', status: 'active' },
                  { label: 'Config Encryption', value: 'AES-256-GCM', status: 'active' },
                  { label: 'Account Lockout', value: '5 attempts', status: 'active' },
                ].map(({ label, value, status }) => (
                  <div key={label} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{value}</p>
                    </div>
                    <Badge className="bg-node-module/20 text-node-module text-[9px]">{status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-node-group" /> Threat Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { threat: 'Brute Force Attack', source: '45.33.22.11', count: 12, time: '6 hours ago' },
                  { threat: 'Suspicious Device', source: '103.45.67.89', count: 5, time: '30 min ago' },
                  { threat: 'Rate Limit Exceeded', source: '10.0.0.55', count: 3, time: '1 hour ago' },
                ].map(({ threat, source, count, time }) => (
                  <div key={threat} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">{threat}</p>
                      <Badge variant="destructive" className="text-[9px]">{count} events</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Source: {source} · {time}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
