import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart3, Workflow, Users, Shield, Activity, TrendingUp,
  AlertCircle, CheckCircle2, Clock, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const stats = [
  { label: 'Configurations', value: '24', change: '+3 this week', icon: Workflow, color: 'text-primary' },
  { label: 'Active Users', value: '12', change: '+2 new', icon: Users, color: 'text-node-container' },
  { label: 'Security Events', value: '156', change: 'Last 24h', icon: Shield, color: 'text-accent' },
  { label: 'Uptime', value: '99.9%', change: '30 days', icon: Activity, color: 'text-node-module' },
];

const recentActivity = [
  { action: 'Config Updated', detail: 'Streaming Pipeline v2.1', time: '2 min ago', severity: 'info' as const },
  { action: 'User Login', detail: 'admin@configflow.dev', time: '15 min ago', severity: 'info' as const },
  { action: 'Security Alert', detail: 'Failed login attempt from unknown IP', time: '1 hour ago', severity: 'warning' as const },
  { action: 'Config Created', detail: 'CDN Edge Configuration', time: '3 hours ago', severity: 'info' as const },
  { action: 'Permission Changed', detail: 'editor role updated', time: '5 hours ago', severity: 'warning' as const },
  { action: 'Backup Complete', detail: 'Daily automated backup', time: '12 hours ago', severity: 'success' as const },
];

const quickActions = [
  { label: 'Open Editor', icon: Workflow, path: '/editor' },
  { label: 'View Analytics', icon: BarChart3, path: '/analytics' },
  { label: 'Manage Users', icon: Users, path: '/management' },
  { label: 'Security Dashboard', icon: Shield, path: '/admin' },
];

const Dashboard = () => {
  const { user, isDemoMode } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {user?.displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's what's happening with your configurations
          </p>
        </div>
        {isDemoMode && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Zap className="w-3 h-3 mr-1" /> Demo Mode
          </Badge>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, change, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {change}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
                {item.severity === 'warning' ? (
                  <AlertCircle className="w-4 h-4 text-node-group shrink-0" />
                ) : item.severity === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-node-module shrink-0" />
                ) : (
                  <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map(({ label, icon: Icon, path }) => (
              <Button
                key={path}
                variant="outline"
                className="w-full justify-start gap-3 h-11"
                onClick={() => navigate(path)}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'API Response', value: '45ms', status: 'healthy' },
              { label: 'Database', value: 'Connected', status: 'healthy' },
              { label: 'Auth Service', value: 'Active', status: 'healthy' },
              { label: 'Rate Limiting', value: '3-tier', status: 'healthy' },
            ].map(({ label, value, status }) => (
              <div key={label} className="p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${status === 'healthy' ? 'bg-node-module' : 'bg-destructive'}`} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
