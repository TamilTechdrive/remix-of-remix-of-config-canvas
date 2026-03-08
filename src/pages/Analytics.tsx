import {
  BarChart3, TrendingUp, PieChart, Activity, Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const configMetrics = [
  { label: 'Total Configs', value: '24', trend: '+12%' },
  { label: 'Active Nodes', value: '342', trend: '+5%' },
  { label: 'Connections', value: '287', trend: '+8%' },
  { label: 'Rule Violations', value: '7', trend: '-23%' },
];

const typeDistribution = [
  { type: 'Containers', count: 8, pct: 15, color: 'bg-node-container' },
  { type: 'Modules', count: 32, pct: 25, color: 'bg-node-module' },
  { type: 'Groups', count: 64, pct: 30, color: 'bg-node-group' },
  { type: 'Options', count: 238, pct: 30, color: 'bg-node-option' },
];

const topConfigs = [
  { name: 'Streaming Pipeline v2.1', nodes: 48, health: 'healthy', lastMod: '2 hours ago' },
  { name: 'CDN Edge Config', nodes: 32, health: 'warning', lastMod: '1 day ago' },
  { name: 'Auth Service Config', nodes: 24, health: 'healthy', lastMod: '3 days ago' },
  { name: 'Video Encoder Settings', nodes: 56, health: 'critical', lastMod: '1 week ago' },
  { name: 'Analytics Pipeline', nodes: 18, health: 'healthy', lastMod: '2 weeks ago' },
];

const Analytics = () => (
  <div className="p-6 space-y-6 max-w-7xl mx-auto">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-node-container" />
          Data Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configuration health & usage metrics</p>
      </div>
      <Button variant="outline" size="sm" className="gap-2">
        <Download className="w-4 h-4" /> Export Report
      </Button>
    </div>

    {/* Metrics */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {configMetrics.map(({ label, value, trend }) => (
        <Card key={label} className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-3xl font-bold text-foreground">{value}</p>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <TrendingUp className="w-3 h-3" /> {trend}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Node Type Distribution */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-accent" /> Node Type Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {typeDistribution.map(({ type, count, pct, color }) => (
            <div key={type} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-foreground font-medium">{type}</span>
                <span className="text-muted-foreground">{count} ({pct}%)</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Activity Chart Placeholder */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-1.5 px-2">
            {[35, 45, 28, 62, 78, 45, 92, 55, 70, 42, 85, 60, 48, 75, 88, 52, 68, 95, 40, 72].map((h, i) => (
              <div key={i} className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground px-2">
            <span>20 days ago</span>
            <span>Today</span>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Top Configs */}
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Top Configurations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-4 text-[10px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border px-3">
            <span>Name</span><span>Nodes</span><span>Health</span><span>Last Modified</span>
          </div>
          {topConfigs.map((cfg) => (
            <div key={cfg.name} className="grid grid-cols-4 items-center text-sm p-3 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer">
              <span className="font-medium text-foreground truncate pr-2">{cfg.name}</span>
              <span className="text-muted-foreground">{cfg.nodes}</span>
              <Badge className={`text-[10px] w-fit ${
                cfg.health === 'healthy' ? 'bg-node-module/20 text-node-module' :
                cfg.health === 'warning' ? 'bg-node-group/20 text-node-group' :
                'bg-destructive/20 text-destructive'
              }`}>
                {cfg.health}
              </Badge>
              <span className="text-xs text-muted-foreground">{cfg.lastMod}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default Analytics;
