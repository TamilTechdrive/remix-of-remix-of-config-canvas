import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Upload, Database, FileCode, FileText, Download, Trash2,
  Layers, GitBranch, Hash, Eye, Loader2, RefreshCw, ExternalLink,
  Save, Plus, AlertTriangle, AlertCircle, Info, Package, MapPin, ArrowRight,
  Search, FolderOpen, Tv, ChevronsUpDown, Check, GripVertical, Settings, Link2, Wrench,
} from 'lucide-react';
import api, { projectApi } from '@/services/api';
import { sessionDetailToRawConfig } from '@/data/parserToConfig';
import { parseConfigToFlow } from '@/data/configParser';
import { cn } from '@/lib/utils';

interface ParserSession {
  id: string;
  session_name: string;
  source_file_name: string;
  total_processed_files: number;
  total_included_files: number;
  total_define_vars: number;
  total_env_vars: number;
  total_toolset_vars: number;
  created_at: string;
}

const parserApi = {
  seed: (data: { jsonData?: any; sessionName?: string; projectId?: string; buildId?: string; moduleId?: string }) =>
    api.post('/parser/seed', data),
  listSessions: () => api.get('/parser/sessions'),
  getSession: (id: string) => api.get(`/parser/sessions/${id}`),
  deleteSession: (id: string) => api.delete(`/parser/sessions/${id}`),
  exportCSV: (id: string, sheet: string) =>
    api.get(`/parser/sessions/${id}/export`, { params: { sheet }, responseType: 'blob' }),
};

const MODULE_COLORS: Record<string, string> = {
  eDBE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  epress: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  egos: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  eintr: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ekernal: 'bg-red-500/10 text-red-400 border-red-500/30',
  ekernel: 'bg-red-500/10 text-red-400 border-red-500/30',
  loader: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  Simple: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
};

function getModuleColor(mod: string): string {
  return MODULE_COLORS[mod] || 'bg-muted text-muted-foreground border-border';
}

function DiagnosticIcon({ level }: { level: string }) {
  if (level === 'error') return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (level === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
}

function diagnosticBadgeClass(level: string): string {
  if (level === 'error') return 'bg-destructive/10 text-destructive border-destructive/30';
  if (level === 'warning') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
}

// ── Searchable Select Combo ──
function SearchableSelect({
  value, onValueChange, options, placeholder, searchPlaceholder, icon: Icon, label,
}: {
  value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string; description?: string }[];
  placeholder: string; searchPlaceholder: string; icon: React.ElementType; label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-sm font-normal h-9">
            {selected ? <span className="truncate">{selected.label}</span> : <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt.value} value={`${opt.label} ${opt.description || ''}`}
                  onSelect={() => { onValueChange(opt.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <div><span className="text-sm">{opt.label}</span>
                    {opt.description && <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup></CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Var Relations Display ──
function VarRelations({ data, showEnvRefs }: { data: any; showEnvRefs?: boolean }) {
  const hasAny = data.parents?.length > 0 || data.siblings?.length > 0 || data.children?.length > 0
    || data.refs?.length > 0 || (showEnvRefs && (data.envParents?.length > 0 || data.envSiblings?.length > 0));
  if (!hasAny) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <GitBranch className="h-3 w-3" /> Relationships
      </p>
      {data.parents?.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground w-16">Parents:</span>
          {data.parents.map((p: string) => <Badge key={p} variant="outline" className="text-[10px]"><ArrowRight className="h-2 w-2 mr-0.5" />{p}</Badge>)}
        </div>
      )}
      {data.siblings?.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground w-16">Siblings:</span>
          {data.siblings.map((s: string) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
        </div>
      )}
      {data.children?.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground w-16">Children:</span>
          {data.children.map((c: string) => <Badge key={c} variant="outline" className="text-[10px]"><ArrowRight className="h-2 w-2 rotate-180 mr-0.5" />{c}</Badge>)}
        </div>
      )}
      {data.refs?.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground w-16">Refs:</span>
          {data.refs.map((r: string) => <Badge key={r} variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">{r}</Badge>)}
        </div>
      )}
      {showEnvRefs && data.envParents?.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground w-16">Env Parents:</span>
          {data.envParents.map((p: string) => <Badge key={p} variant="outline" className="text-[10px] bg-teal-500/10 text-teal-400 border-teal-500/30"><Link2 className="h-2 w-2 mr-0.5" />{p}</Badge>)}
        </div>
      )}
      {showEnvRefs && data.envSiblings?.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground w-16">Env Siblings:</span>
          {data.envSiblings.map((s: string) => <Badge key={s} variant="outline" className="text-[10px] bg-teal-500/10 text-teal-400 border-teal-500/30">{s}</Badge>)}
        </div>
      )}
    </div>
  );
}

export default function ParserData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionName, setSessionName] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [uploadedJson, setUploadedJson] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveSessionId, setSaveSessionId] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [diagnosticFilter, setDiagnosticFilter] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedBuild, setSelectedBuild] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [draggedSession, setDraggedSession] = useState<string | null>(null);

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
  const moduleOptions = Object.keys(MODULE_COLORS).map(m => ({ value: m, label: m }));

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['parser-sessions'],
    queryFn: async () => (await parserApi.listSessions()).data as ParserSession[],
  });

  const { data: sessionDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['parser-session', selectedSession],
    queryFn: async () => (await parserApi.getSession(selectedSession!)).data,
    enabled: !!selectedSession,
  });

  const seedMutation = useMutation({
    mutationFn: (data: any) => parserApi.seed(data),
    onSuccess: (res) => {
      const s = res.data.stats;
      toast.success(`Seeded: ${s?.processedFiles || 0} files, ${s?.defineVars || 0} defines, ${s?.envVars || 0} env vars, ${s?.toolsetVars || 0} toolset vars`);
      queryClient.invalidateQueries({ queryKey: ['parser-sessions'] });
      setSelectedSession(res.data.sessionId);
    },
    onError: () => toast.error('Seed failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => parserApi.deleteSession(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['parser-sessions'] }); setSelectedSession(null); },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { setUploadedJson(JSON.parse(ev.target?.result as string)); toast.success(`Parsed ${file.name}`); }
      catch { toast.error('Invalid JSON'); }
    };
    reader.readAsText(file);
  };

  const handleSeed = () => {
    seedMutation.mutate({
      jsonData: uploadedJson || undefined,
      sessionName: sessionName || `Import ${new Date().toLocaleString()}`,
      projectId: selectedProject || undefined, buildId: selectedBuild || undefined, moduleId: selectedModule || undefined,
    });
  };

  const handleExport = async (sheet: string) => {
    if (!selectedSession) return;
    try {
      const res = await parserApi.exportCSV(selectedSession, sheet);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = `${sheet}_${selectedSession.slice(0, 8)}.csv`; a.click();
      URL.revokeObjectURL(url); toast.success(`Exported ${sheet}`);
    } catch { toast.error('Export failed'); }
  };

  const openSaveDialog = (sessionId: string) => { setSaveSessionId(sessionId); setSaveDialogOpen(true); };

  const handleDragStart = (e: React.DragEvent, sid: string) => { setDraggedSession(sid); e.dataTransfer.setData('text/plain', sid); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const sid = e.dataTransfer.getData('text/plain'); if (sid) { setSelectedSession(sid); openSaveDialog(sid); } setDraggedSession(null); };

  // Filtered data
  const filteredDefineVars = useMemo(() => {
    if (!sessionDetail?.defineVars) return [];
    let vars = sessionDetail.defineVars;
    if (moduleFilter !== 'all') vars = vars.filter((dv: any) => dv.source_module === moduleFilter);
    if (diagnosticFilter !== 'all') vars = vars.filter((dv: any) => dv.diagnostic_level === diagnosticFilter);
    return vars;
  }, [sessionDetail?.defineVars, moduleFilter, diagnosticFilter]);

  const filteredEnvVars = useMemo(() => {
    if (!sessionDetail?.envVars) return [];
    if (moduleFilter === 'all') return sessionDetail.envVars;
    return sessionDetail.envVars.filter((v: any) => v.source_module === moduleFilter);
  }, [sessionDetail?.envVars, moduleFilter]);

  const filteredProcessedFiles = useMemo(() => {
    if (!sessionDetail?.processedFiles) return [];
    if (moduleFilter === 'all') return sessionDetail.processedFiles;
    return sessionDetail.processedFiles.filter((f: any) => f.source_module === moduleFilter);
  }, [sessionDetail?.processedFiles, moduleFilter]);

  const filteredIncludedFiles = useMemo(() => {
    if (!sessionDetail?.includedFiles) return [];
    if (moduleFilter === 'all') return sessionDetail.includedFiles;
    return sessionDetail.includedFiles.filter((f: any) => f.source_module === moduleFilter);
  }, [sessionDetail?.includedFiles, moduleFilter]);

  const toolsetVars = sessionDetail?.toolsetVars || [];

  // Group defines by source file for accordion
  const definesBySource = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (filteredDefineVars || []).forEach((dv: any) => {
      const key = dv.source_file_name || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(dv);
    });
    return groups;
  }, [filteredDefineVars]);

  // Group env vars by source file
  const envVarsBySource = useMemo(() => {
    const groups: Record<string, any[]> = {};
    (filteredEnvVars || []).forEach((v: any) => {
      const key = v.source_file_name || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    });
    return groups;
  }, [filteredEnvVars]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileCode className="h-6 w-6 text-primary" /> C/C++ Parser Data Manager
        </h1>
        <p className="text-muted-foreground mt-1">
          Import and analyze MakeOpt/CCPP parser data — ProcessedFiles, EnvVars, DefineVars, ToolsetVars
        </p>
      </div>

      {/* Context Selection */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><FolderOpen className="h-5 w-5" /> Context Selection</CardTitle>
          <CardDescription>Select project, build, and module to associate with imported data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SearchableSelect value={selectedProject} onValueChange={(v) => { setSelectedProject(v); setSelectedModel(''); setSelectedBuild(''); }}
              options={(projects || []).map((p: any) => ({ value: p.id, label: p.name, description: p.status }))}
              placeholder="Select project..." searchPlaceholder="Search projects..." icon={FolderOpen} label="Project" />
            <SearchableSelect value={selectedModel} onValueChange={(v) => { setSelectedModel(v); setSelectedBuild(''); }}
              options={stbModels.map((m: any) => ({ value: m.id, label: m.name, description: m.chipset }))}
              placeholder="Select STB model..." searchPlaceholder="Search models..." icon={Tv} label="STB Model" />
            <SearchableSelect value={selectedBuild} onValueChange={setSelectedBuild}
              options={builds.map((b: any) => ({ value: b.id, label: `${b.name} (${b.version || 'v1'})`, description: b.status }))}
              placeholder="Select build..." searchPlaceholder="Search builds..." icon={Package} label="Build" />
            <SearchableSelect value={selectedModule} onValueChange={setSelectedModule}
              options={moduleOptions} placeholder="Select module (team)..." searchPlaceholder="Search modules..." icon={Layers} label="Module (Team)" />
          </div>
          {selectedProject && selectedBuild && selectedModule && (
            <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-primary flex items-center gap-2">
              <Check className="h-3.5 w-3.5" /> Context ready: uploads will be tagged to this project/build/module
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import & Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5" /> Import & Seed</CardTitle>
          <CardDescription>Upload JSON or use sample data. Drag sessions to assign to a build.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input type="file" accept=".json" onChange={handleFileUpload} className="cursor-pointer" />
              {fileName && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {fileName}
                  {uploadedJson && <Badge variant="outline" className="text-xs ml-1">Ready</Badge>}
                </p>
              )}
            </div>
            <Input placeholder="Session name (optional)" value={sessionName} onChange={(e) => setSessionName(e.target.value)} className="sm:w-64" />
          </div>
          {/* JSON preview summary */}
          {uploadedJson && (
            <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
              <p className="font-medium text-foreground">JSON Summary:</p>
              <div className="flex flex-wrap gap-3">
                {uploadedJson.ProcessedFiles && <Badge variant="outline"><FileCode className="h-3 w-3 mr-1" />{Object.keys(uploadedJson.ProcessedFiles).length} file types</Badge>}
                {uploadedJson.EnvVars && <Badge variant="outline"><Settings className="h-3 w-3 mr-1" />{Object.keys(uploadedJson.EnvVars).length} env vars</Badge>}
                {uploadedJson.DefineVars && <Badge variant="outline"><Hash className="h-3 w-3 mr-1" />{Object.keys(uploadedJson.DefineVars).length} define vars</Badge>}
                {uploadedJson.ToolsetVars && <Badge variant="outline"><Wrench className="h-3 w-3 mr-1" />{Object.keys(uploadedJson.ToolsetVars).length} toolsets</Badge>}
                {uploadedJson['MOFP.IncFiles'] && <Badge variant="outline">MOFP: {uploadedJson['MOFP.IncFiles'].length} includes</Badge>}
                {uploadedJson['CSHFP.IncFiles'] && <Badge variant="outline">CSHFP: {uploadedJson['CSHFP.IncFiles'].length} includes</Badge>}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleSeed} disabled={seedMutation.isPending}>
              {seedMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Seeding...</>
                : <><Database className="h-4 w-4 mr-2" /> {uploadedJson ? 'Seed Uploaded JSON' : 'Seed Sample Data'}</>}
            </Button>
            {uploadedJson && <Button variant="ghost" onClick={() => { setUploadedJson(null); setFileName(''); }}>Clear Upload</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" /> Seeded Sessions
            <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['parser-sessions'] })}><RefreshCw className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground font-normal ml-2">Drag a session to assign it to a build</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
          ) : !sessions?.length ? (
            <p className="text-muted-foreground">No sessions yet. Import and seed data to get started.</p>
          ) : (
            <div className="space-y-2" onDragOver={handleDragOver} onDrop={handleDrop}>
              {sessions.map((s) => (
                <div key={s.id} draggable onDragStart={(e) => handleDragStart(e, s.id)}
                  className={cn("flex items-center justify-between p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors",
                    selectedSession === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                    draggedSession === s.id && 'opacity-50 border-dashed'
                  )} onClick={() => setSelectedSession(s.id)}>
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <div>
                      <p className="font-medium text-foreground">{s.session_name}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><FileCode className="h-3 w-3" /> {s.total_processed_files} files</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {s.total_included_files} includes</span>
                        <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {s.total_define_vars} defines</span>
                        {(s.total_env_vars || 0) > 0 && <span className="flex items-center gap-1"><Settings className="h-3 w-3" /> {s.total_env_vars} env</span>}
                        {(s.total_toolset_vars || 0) > 0 && <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {s.total_toolset_vars} toolsets</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/editor?parserSession=${s.id}`); }}>
                      <ExternalLink className="h-4 w-4 mr-1" /> Preview
                    </Button>
                    <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); openSaveDialog(s.id); }}>
                      <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Detail */}
      {selectedSession && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2"><Eye className="h-5 w-5" /> Session Data</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => navigate(`/editor?parserSession=${selectedSession}`)}><ExternalLink className="h-4 w-4 mr-1" /> Preview</Button>
                  <Button size="sm" variant="default" onClick={() => openSaveDialog(selectedSession)}><Save className="h-4 w-4 mr-1" /> Save to Build</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('processedFiles')}><Download className="h-4 w-4 mr-1" /> Files</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('defineVars')}><Download className="h-4 w-4 mr-1" /> Defines</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('envVars')}><Download className="h-4 w-4 mr-1" /> EnvVars</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('toolsetVars')}><Download className="h-4 w-4 mr-1" /> Toolset</Button>
                </div>
              </div>

              {!loadingDetail && sessionDetail && (
                <div className="flex items-center gap-3 flex-wrap">
                  {sessionDetail.diagnosticsSummary && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Diagnostics:</span>
                      {(['error', 'warning', 'info'] as const).map(level => (
                        <Badge key={level} variant="outline"
                          className={cn("cursor-pointer", diagnosticBadgeClass(level), diagnosticFilter === level && 'ring-1 ring-offset-1')}
                          onClick={() => setDiagnosticFilter(diagnosticFilter === level ? 'all' : level)}>
                          <DiagnosticIcon level={level} />
                          <span className="ml-1">
                            {level === 'error' ? sessionDetail.diagnosticsSummary.errors :
                             level === 'warning' ? sessionDetail.diagnosticsSummary.warnings :
                             sessionDetail.diagnosticsSummary.info} {level}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {sessionDetail.modules?.length > 0 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="outline" className={cn("cursor-pointer text-[10px]", moduleFilter === 'all' && 'bg-primary/10 text-primary border-primary/30')}
                        onClick={() => setModuleFilter('all')}>All</Badge>
                      {sessionDetail.modules.map((mod: string) => (
                        <Badge key={mod} variant="outline"
                          className={cn("cursor-pointer text-[10px]", moduleFilter === mod ? getModuleColor(mod) : 'opacity-60 hover:opacity-100')}
                          onClick={() => setModuleFilter(moduleFilter === mod ? 'all' : mod)}>{mod}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingDetail ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : sessionDetail ? (
              <Tabs defaultValue="defines" className="w-full">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="defines">Define Vars ({filteredDefineVars?.length || 0})</TabsTrigger>
                  <TabsTrigger value="envvars">Env Vars ({filteredEnvVars?.length || 0})</TabsTrigger>
                  <TabsTrigger value="toolset">Toolset ({toolsetVars?.length || 0})</TabsTrigger>
                  <TabsTrigger value="processed">Files ({filteredProcessedFiles?.length || 0})</TabsTrigger>
                  <TabsTrigger value="included">Includes ({filteredIncludedFiles?.length || 0})</TabsTrigger>
                </TabsList>

                {/* ═══ Define Variables ═══ */}
                <TabsContent value="defines">
                  <ScrollArea className="h-[500px]">
                    <Accordion type="multiple" defaultValue={Object.keys(definesBySource)} className="space-y-2">
                      {Object.entries(definesBySource).map(([src, vars]) => (
                        <AccordionItem key={src} value={src} className="border rounded-lg px-3">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium font-mono">{src}</span>
                              <Badge variant="outline" className="text-[10px]">{vars.length}</Badge>
                              {vars[0]?.source_module && <Badge variant="outline" className={cn("text-[10px]", getModuleColor(vars[0].source_module))}>{vars[0].source_module}</Badge>}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader><TableRow>
                                <TableHead className="w-8"></TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>HitSrc</TableHead>
                                <TableHead>VarType</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>ValProp</TableHead>
                                <TableHead>Line</TableHead>
                                <TableHead>Relations</TableHead>
                                <TableHead>Hits</TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {vars.map((dv: any) => <DefineVarTableRow key={dv.id} dv={dv} />)}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    {Object.keys(definesBySource).length === 0 && <p className="text-muted-foreground text-sm p-4">No define variables match current filters.</p>}
                  </ScrollArea>
                </TabsContent>

                {/* ═══ Environment Variables ═══ */}
                <TabsContent value="envvars">
                  <div className="mb-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                    <Settings className="h-3.5 w-3.5" />
                    Environment variables from MOFP (opt files). These are linked to DefineVars via EnvParList/EnvSibList cross-references.
                  </div>
                  <ScrollArea className="h-[500px]">
                    <Accordion type="multiple" defaultValue={Object.keys(envVarsBySource)} className="space-y-2">
                      {Object.entries(envVarsBySource).map(([src, vars]) => (
                        <AccordionItem key={src} value={src} className="border rounded-lg px-3">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium font-mono">{src}</span>
                              <Badge variant="outline" className="text-[10px]">{vars.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader><TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>HitSrc</TableHead>
                                <TableHead>VarType</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>ValProp</TableHead>
                                <TableHead>Line</TableHead>
                                <TableHead>Parents</TableHead>
                                <TableHead>Siblings</TableHead>
                                <TableHead>Children</TableHead>
                                <TableHead>Hits</TableHead>
                              </TableRow></TableHeader>
                              <TableBody>
                                {vars.map((v: any) => <EnvVarTableRow key={v.id} v={v} />)}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    {Object.keys(envVarsBySource).length === 0 && <p className="text-muted-foreground text-sm p-4">No environment variables.</p>}
                  </ScrollArea>
                </TabsContent>

                {/* ═══ Toolset Variables ═══ */}
                <TabsContent value="toolset">
                  <div className="mb-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5" />
                    Toolset compiler options from .opt files. -D flags link to DefineVars in header files. -I flags define include paths.
                  </div>
                  <ScrollArea className="h-[500px]">
                    <Accordion type="multiple" defaultValue={toolsetVars.map((_: any, i: number) => String(i))} className="space-y-2">
                      {toolsetVars.map((tv: any, i: number) => (
                        <AccordionItem key={tv.id || i} value={String(i)} className="border rounded-lg px-3">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-bold">{tv.toolset_name}</span>
                              <Badge variant="outline" className="text-[10px]">{tv.switchOpts?.length || 0} options</Badge>
                              {tv.src_line_ref && <span className="font-mono text-[10px] text-muted-foreground">{tv.src_line_ref}</span>}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {tv.switchOptsByKey && Object.entries(tv.switchOptsByKey).map(([swKey, opts]: [string, any]) => (
                              <div key={swKey} className="mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs font-mono">-{swKey}</Badge>
                                  <span className="text-xs text-muted-foreground">{opts.length} entries</span>
                                  {swKey === 'D' && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">→ DefineVars</Badge>}
                                  {swKey === 'I' && <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">Include Paths</Badge>}
                                </div>
                                <Table>
                                  <TableHeader><TableRow>
                                    <TableHead>Option</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Line Ref</TableHead>
                                  </TableRow></TableHeader>
                                  <TableBody>
                                    {opts.map((opt: any) => (
                                      <TableRow key={opt.id}>
                                        <TableCell className="font-mono text-xs font-medium">{opt.opt_name}</TableCell>
                                        <TableCell className="text-xs">{opt.opt_value || '—'}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[10px]">{opt.opt_source}</Badge></TableCell>
                                        <TableCell className="font-mono text-[10px] text-muted-foreground">{opt.opt_line_ref}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                    {toolsetVars.length === 0 && <p className="text-muted-foreground text-sm p-4">No toolset variables.</p>}
                  </ScrollArea>
                </TabsContent>

                {/* ═══ Processed Files ═══ */}
                <TabsContent value="processed">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Module</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Lines</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                        <TableHead className="text-right">#if</TableHead>
                        <TableHead className="text-right">#elif</TableHead>
                        <TableHead className="text-right">#else</TableHead>
                        <TableHead className="text-right">#endif</TableHead>
                        <TableHead className="text-right">Nest</TableHead>
                        <TableHead className="text-right">Def Hits</TableHead>
                        <TableHead className="text-right">Macros</TableHead>
                        <TableHead className="text-right">Time (s)</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredProcessedFiles?.map((f: any) => (
                          <TableRow key={f.id}>
                            <TableCell><Badge variant="outline" className={cn("text-[10px]", getModuleColor(f.source_module || ''))}>{f.source_module || '—'}</Badge></TableCell>
                            <TableCell>
                              <TooltipProvider><Tooltip><TooltipTrigger><span className="font-mono text-xs">{f.file_name}</span></TooltipTrigger>
                                <TooltipContent><p className="font-mono text-xs">{f.file_name_full}</p></TooltipContent></Tooltip></TooltipProvider>
                            </TableCell>
                            <TableCell><Badge variant="outline">{f.file_type}</Badge></TableCell>
                            <TableCell className="text-right">{Number(f.input_line_count || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">{Number(f.used_line_count || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">{f.cond_if}</TableCell>
                            <TableCell className="text-right">{f.cond_elif}</TableCell>
                            <TableCell className="text-right">{f.cond_else}</TableCell>
                            <TableCell className="text-right">{f.cond_endif}</TableCell>
                            <TableCell className="text-right">{f.cond_nest_block}</TableCell>
                            <TableCell className="text-right">{f.def_hit_count}</TableCell>
                            <TableCell className="text-right">{f.macro_hit_count}</TableCell>
                            <TableCell className="text-right">{Number(f.time_delta || 0).toFixed(4)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                {/* ═══ Included Files ═══ */}
                <TabsContent value="included">
                  <div className="mb-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    MOFP = Make Opt File Parser includes (.opt files) • CSHFP = C/C++ SH Header File Parser includes (.h files)
                  </div>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Parser</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Include File</TableHead>
                        <TableHead>Source File</TableHead>
                        <TableHead>Line #</TableHead>
                        <TableHead>Full Reference</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredIncludedFiles?.map((inc: any) => (
                          <TableRow key={inc.id}>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px]",
                                inc.include_type === 'CSHFP' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              )}>{inc.include_type}</Badge>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={cn("text-[10px]", getModuleColor(inc.source_module || ''))}>{inc.source_module || '—'}</Badge></TableCell>
                            <TableCell className="font-mono text-xs font-medium">{inc.include_file_name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{inc.source_file_name || '—'}</TableCell>
                            <TableCell>
                              {inc.source_line_number ? <Badge variant="outline" className="text-[10px] font-mono"><MapPin className="h-2.5 w-2.5 mr-0.5" />#{inc.source_line_number}</Badge> : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-[10px] text-muted-foreground">{inc.source_line_ref}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : null}
          </CardContent>
        </Card>
      )}

      <SaveToProjectDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen} parserSessionId={saveSessionId}
        initialProject={selectedProject} initialModel={selectedModel} initialBuild={selectedBuild}
        onSaved={(configId) => { toast.success('Config saved!'); navigate(`/editor?configId=${configId}`); }} />
    </div>
  );
}

// ── Define Var Table Row ──
function DefineVarTableRow({ dv }: { dv: any }) {
  const [expanded, setExpanded] = useState(false);
  const relCount = (dv.parents?.length || 0) + (dv.siblings?.length || 0) + (dv.children?.length || 0)
    + (dv.refs?.length || 0) + (dv.envParents?.length || 0) + (dv.envSiblings?.length || 0);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(!expanded)}>
        <TableCell><DiagnosticIcon level={dv.diagnostic_level || 'info'} /></TableCell>
        <TableCell className="font-mono text-xs font-medium">{dv.var_name}</TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{dv.first_hit_src}</Badge></TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{dv.first_hit_var_type}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">{dv.first_hit_var_scope}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{dv.first_hit_val_prop}</TableCell>
        <TableCell><span className="font-mono text-[10px]"><MapPin className="h-2.5 w-2.5 inline" /> :{dv.source_line_number}</span></TableCell>
        <TableCell><Badge variant="secondary" className="text-[10px]">{relCount}</Badge></TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{dv.allHits?.length || 0}</Badge></TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30 p-4">
            <div className="space-y-3">
              {dv.diagnostic_message && (
                <div className={cn("p-2 rounded text-xs flex items-start gap-2",
                  dv.diagnostic_level === 'error' ? 'bg-destructive/10 text-destructive' :
                  dv.diagnostic_level === 'warning' ? 'bg-amber-500/10 text-amber-300' : 'bg-blue-500/10 text-blue-300')}>
                  <DiagnosticIcon level={dv.diagnostic_level || 'info'} /><span>{dv.diagnostic_message}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Full Ref:</span> <span className="font-mono">{dv.first_hit_slnr}</span></div>
                <div><span className="text-muted-foreground">Last Hit:</span> <span className="font-mono">{dv.last_hit_slnr}</span></div>
                {dv.cond_ord_dir && <div><span className="text-muted-foreground">Cond:</span> #{dv.cond_ord_dir} depth={dv.cond_ord_depth} @ {dv.cond_ord_slnr}</div>}
                {dv.first_hit_flags > 0 && <div><span className="text-muted-foreground">Flags:</span> {dv.first_hit_flags}</div>}
              </div>
              <VarRelations data={dv} showEnvRefs />
              {dv.valEntries?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Value Entries</p>
                  <div className="space-y-0.5">
                    {dv.valEntries.map((ve: any, i: number) => (
                      <div key={i} className="text-xs flex items-center gap-2 p-1 rounded hover:bg-muted/30">
                        <Badge variant="outline" className="text-[10px] font-mono">{ve.value_key}</Badge>
                        <span className="text-muted-foreground text-[10px]">
                          {(() => { try { const items = typeof ve.value_items === 'string' ? JSON.parse(ve.value_items) : ve.value_items; return `${items?.length || 0} entries`; } catch { return '—'; } })()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dv.allHits?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">All Occurrences ({dv.allHits.length})</p>
                  <div className="space-y-0.5">
                    {dv.allHits.map((h: any, i: number) => (
                      <div key={i} className="text-xs flex items-center gap-2 p-1 rounded hover:bg-muted/30">
                        <Badge variant="outline" className={cn("text-[10px]", getModuleColor(h.source_module || ''))}>{h.source_module || '—'}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{h.hit_src}</Badge>
                        <span className="text-muted-foreground">{h.var_type}</span>
                        <span className="text-muted-foreground">{h.var_scope}</span>
                        {h.cond_ord_dir && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400">{h.cond_ord_dir}</Badge>}
                        <span className="font-mono text-[10px] ml-auto"><MapPin className="h-2.5 w-2.5 inline mr-0.5" />{h.source_file_name}:{h.source_line_number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Env Var Table Row ──
function EnvVarTableRow({ v }: { v: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(!expanded)}>
        <TableCell className="font-mono text-xs font-medium">{v.var_name}</TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{v.first_hit_src}</Badge></TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{v.first_hit_var_type}</Badge></TableCell>
        <TableCell className="text-xs text-muted-foreground">{v.first_hit_var_scope}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{v.first_hit_val_prop}</TableCell>
        <TableCell><span className="font-mono text-[10px]"><MapPin className="h-2.5 w-2.5 inline" /> :{v.source_line_number}</span></TableCell>
        <TableCell><Badge variant="secondary" className="text-[10px]">{v.parents?.length || 0}</Badge></TableCell>
        <TableCell><Badge variant="secondary" className="text-[10px]">{v.siblings?.length || 0}</Badge></TableCell>
        <TableCell><Badge variant="secondary" className="text-[10px]">{v.children?.length || 0}</Badge></TableCell>
        <TableCell><Badge variant="outline" className="text-[10px]">{v.allHits?.length || 0}</Badge></TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={10} className="bg-muted/30 p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Full Ref:</span> <span className="font-mono">{v.first_hit_slnr}</span></div>
                <div><span className="text-muted-foreground">Last Hit:</span> <span className="font-mono">{v.last_hit_slnr}</span></div>
                {v.cond_ord_dir && <div><span className="text-muted-foreground">Cond:</span> #{v.cond_ord_dir} depth={v.cond_ord_depth}</div>}
              </div>
              <VarRelations data={v} />
              {v.valEntries?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Value Entries</p>
                  {v.valEntries.map((ve: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-1">
                      <Badge variant="outline" className="text-[10px] font-mono">{ve.value_key}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {v.allHits?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">All Hits ({v.allHits.length})</p>
                  {v.allHits.map((h: any, i: number) => (
                    <div key={i} className="text-xs flex items-center gap-2 p-1 rounded hover:bg-muted/30">
                      <Badge variant="secondary" className="text-[10px]">{h.hit_src}</Badge>
                      <span className="text-muted-foreground">{h.var_scope}</span>
                      {h.cond_ord_dir && <Badge variant="outline" className="text-[10px]">{h.cond_ord_dir}</Badge>}
                      <span className="font-mono text-[10px] ml-auto">{h.source_file_name}:{h.source_line_number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Save to Project Dialog ──
function SaveToProjectDialog({
  open, onOpenChange, parserSessionId, onSaved, initialProject, initialModel, initialBuild,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; parserSessionId: string | null;
  onSaved: (configId: string) => void; initialProject?: string; initialModel?: string; initialBuild?: string;
}) {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState(initialProject || '');
  const [selectedModel, setSelectedModel] = useState(initialModel || '');
  const [selectedBuild, setSelectedBuild] = useState(initialBuild || '');
  const [configName, setConfigName] = useState('');
  const [saving, setSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newBuildName, setNewBuildName] = useState('');
  const [creating, setCreating] = useState<string | null>(null);

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: async () => { try { return (await projectApi.list()).data; } catch { return []; } }, enabled: open });
  const { data: projectDetail } = useQuery({ queryKey: ['project-detail', selectedProject], queryFn: async () => (await projectApi.get(selectedProject)).data, enabled: !!selectedProject });

  const stbModels = projectDetail?.stbModels || projectDetail?.stb_models || [];
  const selectedModelData = stbModels.find((m: any) => m.id === selectedModel);
  const builds = selectedModelData?.builds || [];

  const handleCreate = async (type: 'project' | 'model' | 'build') => {
    setCreating(type);
    try {
      if (type === 'project' && newProjectName.trim()) { const res = await projectApi.create({ name: newProjectName }); setSelectedProject(res.data.id); setNewProjectName(''); queryClient.invalidateQueries({ queryKey: ['projects'] }); }
      else if (type === 'model' && newModelName.trim() && selectedProject) { const res = await projectApi.createSTBModel(selectedProject, { name: newModelName }); setSelectedModel(res.data.id); setNewModelName(''); queryClient.invalidateQueries({ queryKey: ['project-detail', selectedProject] }); }
      else if (type === 'build' && newBuildName.trim() && selectedModel) { const res = await projectApi.createBuild(selectedModel, { name: newBuildName }); setSelectedBuild(res.data.id); setNewBuildName(''); queryClient.invalidateQueries({ queryKey: ['project-detail', selectedProject] }); }
      toast.success(`${type} created`);
    } catch { toast.error(`Failed to create ${type}`); }
    setCreating(null);
  };

  const handleSave = async () => {
    if (!selectedBuild || !parserSessionId) return;
    setSaving(true);
    try {
      const sessionRes = await api.get(`/parser/sessions/${parserSessionId}`);
      const rawConfig = sessionDetailToRawConfig(sessionRes.data);
      const { nodes, edges } = parseConfigToFlow(rawConfig);
      const res = await projectApi.saveParserConfig(selectedBuild, { parserSessionId, configName: configName || `Parser Config ${new Date().toLocaleString()}`, nodes, edges });
      onSaved(res.data.configId); onOpenChange(false);
    } catch { toast.error('Failed to save config'); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Save className="h-5 w-5 text-primary" /> Save Config to Build</DialogTitle>
          <DialogDescription>Convert parser data and save to Project → STB Model → Build</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Config Name</Label><Input placeholder="e.g., Parser Config" value={configName} onChange={e => setConfigName(e.target.value)} className="mt-1" /></div>
          <div><Label>Project</Label>
            <div className="flex gap-2 mt-1">
              <Popover><PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-between font-normal">{projects?.find((p: any) => p.id === selectedProject)?.name || 'Select project...'}<ChevronsUpDown className="h-3.5 w-3.5 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="p-0"><Command><CommandInput placeholder="Search..." /><CommandList><CommandEmpty>No projects</CommandEmpty><CommandGroup>
                  {(projects || []).map((p: any) => (<CommandItem key={p.id} onSelect={() => { setSelectedProject(p.id); setSelectedModel(''); setSelectedBuild(''); }}>{p.name}</CommandItem>))}
                </CommandGroup></CommandList></Command></PopoverContent></Popover>
            </div>
            <div className="flex gap-2 mt-1"><Input placeholder="New project" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="flex-1 h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={() => handleCreate('project')} disabled={creating === 'project'}><Plus className="h-3 w-3 mr-1" />Create</Button></div>
          </div>
          {selectedProject && <div><Label>STB Model</Label>
            <div className="flex gap-2 mt-1"><Popover><PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-between font-normal">{stbModels.find((m: any) => m.id === selectedModel)?.name || 'Select model...'}<ChevronsUpDown className="h-3.5 w-3.5 opacity-50" /></Button></PopoverTrigger>
              <PopoverContent className="p-0"><Command><CommandInput placeholder="Search..." /><CommandList><CommandEmpty>No models</CommandEmpty><CommandGroup>
                {stbModels.map((m: any) => (<CommandItem key={m.id} onSelect={() => { setSelectedModel(m.id); setSelectedBuild(''); }}>{m.name}</CommandItem>))}
              </CommandGroup></CommandList></Command></PopoverContent></Popover></div>
            <div className="flex gap-2 mt-1"><Input placeholder="New model" value={newModelName} onChange={e => setNewModelName(e.target.value)} className="flex-1 h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={() => handleCreate('model')} disabled={creating === 'model'}><Plus className="h-3 w-3 mr-1" />Create</Button></div>
          </div>}
          {selectedModel && <div><Label>Build</Label>
            <div className="flex gap-2 mt-1"><Popover><PopoverTrigger asChild><Button variant="outline" className="flex-1 justify-between font-normal">{builds.find((b: any) => b.id === selectedBuild)?.name || 'Select build...'}<ChevronsUpDown className="h-3.5 w-3.5 opacity-50" /></Button></PopoverTrigger>
              <PopoverContent className="p-0"><Command><CommandInput placeholder="Search..." /><CommandList><CommandEmpty>No builds</CommandEmpty><CommandGroup>
                {builds.map((b: any) => (<CommandItem key={b.id} onSelect={() => setSelectedBuild(b.id)}>{b.name} ({b.version || 'v1'})</CommandItem>))}
              </CommandGroup></CommandList></Command></PopoverContent></Popover></div>
            <div className="flex gap-2 mt-1"><Input placeholder="New build" value={newBuildName} onChange={e => setNewBuildName(e.target.value)} className="flex-1 h-8 text-xs" />
              <Button size="sm" variant="outline" onClick={() => handleCreate('build')} disabled={creating === 'build'}><Plus className="h-3 w-3 mr-1" />Create</Button></div>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selectedBuild}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save & Open</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
