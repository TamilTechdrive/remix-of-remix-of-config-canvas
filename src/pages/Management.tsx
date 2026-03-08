import { useState } from 'react';
import {
  Settings, Plus, Search, Trash2, Edit, Eye, ToggleLeft,
  FolderOpen, Clock, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

interface ConfigItem {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'archived';
  nodes: number;
  edges: number;
  lastModified: string;
  createdBy: string;
  encrypted: boolean;
}

const sampleConfigs: ConfigItem[] = [
  { id: '1', name: 'Streaming Pipeline v2.1', description: 'Main video streaming config', status: 'active', nodes: 48, edges: 42, lastModified: '2 hours ago', createdBy: 'admin', encrypted: true },
  { id: '2', name: 'CDN Edge Config', description: 'Content delivery settings', status: 'active', nodes: 32, edges: 28, lastModified: '1 day ago', createdBy: 'admin', encrypted: false },
  { id: '3', name: 'Auth Service Config', description: 'Authentication service params', status: 'draft', nodes: 24, edges: 18, lastModified: '3 days ago', createdBy: 'editor1', encrypted: true },
  { id: '4', name: 'Video Encoder Settings', description: 'HW & SW encoder options', status: 'active', nodes: 56, edges: 52, lastModified: '1 week ago', createdBy: 'admin', encrypted: false },
  { id: '5', name: 'Legacy Pipeline (v1)', description: 'Deprecated config', status: 'archived', nodes: 38, edges: 34, lastModified: '1 month ago', createdBy: 'admin', encrypted: false },
];

const Management = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  const filtered = sampleConfigs.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="w-6 h-6 text-muted-foreground" />
            Configuration Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create, edit, and manage your configurations</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/editor')}>
          <Plus className="w-4 h-4" /> New Configuration
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search configurations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card border-border">
            <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Config List */}
      <div className="space-y-3">
        {filtered.map((config) => (
          <Card key={config.id} className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate('/editor')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{config.name}</h3>
                    <Badge className={`text-[10px] ${
                      config.status === 'active' ? 'bg-node-module/20 text-node-module' :
                      config.status === 'draft' ? 'bg-node-group/20 text-node-group' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {config.status}
                    </Badge>
                    {config.encrypted && (
                      <Badge variant="outline" className="text-[9px]">🔒 Encrypted</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span>{config.nodes} nodes</span>
                    <span>{config.edges} edges</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {config.lastModified}</span>
                    <span>by {config.createdBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate('/editor'); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No configurations found</p>
        </div>
      )}
    </div>
  );
};

export default Management;
