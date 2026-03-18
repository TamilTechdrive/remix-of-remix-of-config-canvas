import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Search, Plus, Trash2, FolderOpen, Package, Layers, Check, ChevronsUpDown,
  ChevronRight, Box, Grid3X3, Settings, Save, Filter, Tv, ArrowRight, X,
} from 'lucide-react';
import { projectApi } from '@/services/api';
import { cn } from '@/lib/utils';

interface MappingGroup {
  id: string;
  name: string;
  type: 'container' | 'group';
  items: string[];
}

const MODULE_LIST = ['eDBE', 'epress', 'egos', 'eintr', 'ekernal', 'loader'];

const MODULE_COLORS: Record<string, string> = {
  eDBE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  epress: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  egos: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  eintr: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ekernal: 'bg-red-500/10 text-red-400 border-red-500/30',
  loader: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
};

// Sample options data — in real use from API
const SAMPLE_OPTIONS = [
  'eDBE_THIS_SOURCE_FILE_NAME_REF', 'DBASE_BUILDER_TASK_NAME', 'RELEASE_DYNAMIC_SERVICE_UPDATE_ACCESS',
  'NDBFCM_BUILD_NO', 'NDBFCM_BUILD_DATE', 'LOCK_DYNAMIC_SERVICE_UPDATE_ACCESS',
  'ENABLE_DVB_CI_PLUS', 'ENABLE_MHEG', 'ENABLE_TELETEXT', 'ENABLE_SUBTITLE',
  'ENABLE_PVR_RECORDING', 'ENABLE_TIMESHIFT', 'ENABLE_HLS_STREAMING',
  'DVB_T2_SUPPORT', 'DVB_S2_SUPPORT', 'DVB_C_SUPPORT', 'IPTV_SUPPORT',
  'CA_SYSTEM_NAGRA', 'CA_SYSTEM_IRDETO', 'CA_SYSTEM_CONAX', 'CA_SYSTEM_VIACCESS',
  'HDMI_CEC_SUPPORT', 'HDMI_2_1_SUPPORT', 'USB_3_0_SUPPORT', 'ETHERNET_GIGABIT',
  'WIFI_802_11AC', 'BLUETOOTH_5_0', 'DOLBY_AUDIO', 'DTS_AUDIO', 'HEVC_DECODER',
  'AV1_DECODER', 'VP9_DECODER', 'FAST_BOOT', 'STANDBY_MODE', 'OTA_UPDATE',
];

export default function OptionsMapping() {
  // Context selectors
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedBuild, setSelectedBuild] = useState('');
  const [selectedModule, setSelectedModule] = useState('');

  // Left panel: options selection
  const [searchLeft, setSearchLeft] = useState('');
  const [checkedOptions, setCheckedOptions] = useState<Set<string>>(new Set());
  const [filterModule, setFilterModule] = useState<string>('all');

  // Right panel: groups/containers
  const [groups, setGroups] = useState<MappingGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'container' | 'group'>('group');
  const [searchRight, setSearchRight] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => { try { return (await projectApi.list()).data; } catch { return []; } },
  });

  const { data: projectDetail } = useQuery({
    queryKey: ['project-detail', selectedProject],
    queryFn: async () => (await projectApi.get(selectedProject)).data,
    enabled: !!selectedProject,
  });

  const stbModels = projectDetail?.stbModels || projectDetail?.stb_models || [];
  const selectedModelData = stbModels.find((m: any) => m.id === selectedModel);
  const builds = selectedModelData?.builds || [];

  // Filter options
  const filteredOptions = useMemo(() => {
    let opts = SAMPLE_OPTIONS;
    if (searchLeft) {
      const q = searchLeft.toLowerCase();
      opts = opts.filter(o => o.toLowerCase().includes(q));
    }
    return opts;
  }, [searchLeft]);

  const toggleOption = (opt: string) => {
    const next = new Set(checkedOptions);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    setCheckedOptions(next);
  };

  const selectAll = () => setCheckedOptions(new Set(filteredOptions));
  const clearAll = () => setCheckedOptions(new Set());

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const group: MappingGroup = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: newGroupName.trim(),
      type: newGroupType,
      items: [],
    };
    setGroups(prev => [...prev, group]);
    setNewGroupName('');
    toast.success(`${newGroupType === 'container' ? 'Container' : 'Group'} created`);
  };

  const addSelectedToGroup = (groupId: string) => {
    if (checkedOptions.size === 0) {
      toast.error('No options selected');
      return;
    }
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, items: [...new Set([...g.items, ...Array.from(checkedOptions)])] }
        : g
    ));
    toast.success(`${checkedOptions.size} options added to group`);
    setCheckedOptions(new Set());
  };

  const removeFromGroup = (groupId: string, item: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, items: g.items.filter(i => i !== item) } : g
    ));
  };

  const deleteGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    toast.success('Group deleted');
  };

  const filteredGroups = useMemo(() => {
    if (!searchRight) return groups;
    const q = searchRight.toLowerCase();
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.items.some(i => i.toLowerCase().includes(q))
    );
  }, [groups, searchRight]);

  const handleSave = () => {
    const data = {
      projectId: selectedProject,
      modelId: selectedModel,
      buildId: selectedBuild,
      module: selectedModule,
      groups: groups.map(g => ({ name: g.name, type: g.type, items: g.items })),
    };
    console.log('Saving mapping:', data);
    toast.success('Mapping saved!', { description: `${groups.length} groups with ${groups.reduce((a, g) => a + g.items.length, 0)} total options` });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Grid3X3 className="h-6 w-6 text-primary" /> Options Mapping
        </h1>
        <p className="text-muted-foreground mt-1">
          Select options from the left and organize them into containers/groups on the right
        </p>
      </div>

      {/* Context Selectors */}
      <Card className="border-primary/20">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchableCombo value={selectedProject} onValueChange={v => { setSelectedProject(v); setSelectedModel(''); setSelectedBuild(''); }}
              options={(projects || []).map((p: any) => ({ value: p.id, label: p.name }))}
              placeholder="Project" icon={FolderOpen} label="Project" />
            <SearchableCombo value={selectedModel} onValueChange={v => { setSelectedModel(v); setSelectedBuild(''); }}
              options={stbModels.map((m: any) => ({ value: m.id, label: m.name }))}
              placeholder="STB Model" icon={Tv} label="STB Model" />
            <SearchableCombo value={selectedBuild} onValueChange={setSelectedBuild}
              options={builds.map((b: any) => ({ value: b.id, label: `${b.name} (${b.version || 'v1'})` }))}
              placeholder="Build" icon={Package} label="Build" />
            <SearchableCombo value={selectedModule} onValueChange={setSelectedModule}
              options={MODULE_LIST.map(m => ({ value: m, label: m }))}
              placeholder="Module (Team)" icon={Layers} label="Module" />
          </div>
        </CardContent>
      </Card>

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Panel: Options List ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> Available Options
              <Badge variant="secondary" className="ml-auto text-xs">{checkedOptions.size} selected</Badge>
            </CardTitle>
            <div className="flex gap-2 mt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Filter options..." value={searchLeft} onChange={e => setSearchLeft(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>All</Button>
              <Button variant="outline" size="sm" onClick={clearAll}>None</Button>
            </div>
            {/* Module quick filter */}
            <div className="flex gap-1 mt-2 flex-wrap">
              <Badge variant="outline" className={cn("cursor-pointer text-[10px]", filterModule === 'all' && 'bg-primary/10 text-primary')}
                onClick={() => setFilterModule('all')}>All</Badge>
              {MODULE_LIST.map(m => (
                <Badge key={m} variant="outline"
                  className={cn("cursor-pointer text-[10px]", filterModule === m ? MODULE_COLORS[m] : 'opacity-60 hover:opacity-100')}
                  onClick={() => setFilterModule(filterModule === m ? 'all' : m)}>{m}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-0.5">
                {filteredOptions.map(opt => (
                  <label key={opt}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm",
                      checkedOptions.has(opt) ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
                    )}>
                    <Checkbox
                      checked={checkedOptions.has(opt)}
                      onCheckedChange={() => toggleOption(opt)}
                    />
                    <span className="font-mono text-xs flex-1">{opt}</span>
                    {activeGroupId && checkedOptions.has(opt) && (
                      <ArrowRight className="h-3 w-3 text-primary" />
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ── Right Panel: Groups / Containers ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Box className="h-4 w-4" /> Groups & Containers
              <Badge variant="secondary" className="ml-auto text-xs">{groups.length} groups</Badge>
            </CardTitle>
            <div className="flex gap-2 mt-2">
              <Input placeholder="New group/container name..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="flex-1 h-8 text-sm" />
              <select value={newGroupType} onChange={e => setNewGroupType(e.target.value as any)}
                className="h-8 px-2 text-xs border rounded-md bg-background text-foreground">
                <option value="group">Group</option>
                <option value="container">Container</option>
              </select>
              <Button size="sm" onClick={addGroup} disabled={!newGroupName.trim()}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search groups..." value={searchRight} onChange={e => setSearchRight(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {filteredGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Box className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No groups yet</p>
                  <p className="text-xs">Create a group and add selected options</p>
                </div>
              ) : (
                <Accordion type="multiple" defaultValue={filteredGroups.map(g => g.id)} className="space-y-2">
                  {filteredGroups.map(group => (
                    <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-3">
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          {group.type === 'container' ? (
                            <Box className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Grid3X3 className="h-4 w-4 text-blue-400" />
                          )}
                          <span className="text-sm font-medium">{group.name}</span>
                          <Badge variant="outline" className="text-[10px]">{group.type}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{group.items.length} items</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => addSelectedToGroup(group.id)}
                              disabled={checkedOptions.size === 0} className="text-xs">
                              <Plus className="h-3 w-3 mr-1" /> Add {checkedOptions.size} selected
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => deleteGroup(group.id)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Delete group
                            </Button>
                          </div>
                          {group.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No options in this group. Select options on the left and click "Add".</p>
                          ) : (
                            <div className="space-y-0.5">
                              {group.items.map(item => (
                                <div key={item} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 text-xs">
                                  <span className="font-mono flex-1">{item}</span>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeFromGroup(group.id, item)}>
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={groups.length === 0} className="gap-2">
          <Save className="h-4 w-4" /> Save Mapping Structure
        </Button>
      </div>
    </div>
  );
}

// Inline combo component
function SearchableCombo({ value, onValueChange, options, placeholder, icon: Icon, label }: {
  value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string; icon: React.ElementType; label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-normal h-9">
            {selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command><CommandInput placeholder={`Search ${label.toLowerCase()}...`} /><CommandList><CommandEmpty>No results</CommandEmpty><CommandGroup>
            {options.map(o => (<CommandItem key={o.value} onSelect={() => { onValueChange(o.value); setOpen(false); }}>
              <Check className={cn("mr-2 h-3.5 w-3.5", value === o.value ? "opacity-100" : "opacity-0")} />{o.label}
            </CommandItem>))}
          </CommandGroup></CommandList></Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
