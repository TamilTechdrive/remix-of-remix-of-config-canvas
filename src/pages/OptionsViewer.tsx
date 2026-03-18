import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Search, Eye, FolderOpen, Package, Layers, Check, ChevronsUpDown,
  Link2, Tv, ArrowRight, ArrowLeft, ArrowUpDown, Network,
} from 'lucide-react';
import { projectApi } from '@/services/api';
import { cn } from '@/lib/utils';

const MODULE_LIST = ['eDBE', 'epress', 'egos', 'eintr', 'ekernal', 'loader'];

const MODULE_COLORS: Record<string, string> = {
  eDBE: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  epress: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  egos: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  eintr: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  ekernal: 'bg-red-500/10 text-red-400 border-red-500/30',
  loader: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
};

// Sample mapping data
const SAMPLE_MAPPINGS: OptionMapping[] = [
  {
    name: 'eDBE_THIS_SOURCE_FILE_NAME_REF',
    module: 'eDBE',
    type: 'DEFINITION',
    mappedTo: [
      { module: 'epress', option: 'DBASE_BUILDER_TASK_NAME', relation: 'parent' },
      { module: 'epress', option: 'RELEASE_DYNAMIC_SERVICE_UPDATE_ACCESS', relation: 'parent' },
      { module: 'eDBE', option: 'NDBFCM_BUILD_NO', relation: 'sibling' },
      { module: 'eDBE', option: 'NDBFCM_BUILD_DATE', relation: 'sibling' },
      { module: 'egos', option: 'LOCK_DYNAMIC_SERVICE_UPDATE_ACCESS', relation: 'child' },
    ],
    groups: ['Core Defines', 'Build Info'],
    sourceFile: 'ndbfcm.c',
    sourceLine: 127,
  },
  {
    name: 'ENABLE_DVB_CI_PLUS',
    module: 'epress',
    type: 'CONDITIONAL',
    mappedTo: [
      { module: 'egos', option: 'CA_SYSTEM_NAGRA', relation: 'child' },
      { module: 'egos', option: 'CA_SYSTEM_IRDETO', relation: 'child' },
      { module: 'eintr', option: 'HDMI_CEC_SUPPORT', relation: 'sibling' },
      { module: 'ekernal', option: 'FAST_BOOT', relation: 'parent' },
    ],
    groups: ['DVB Features'],
    sourceFile: 'dvb_config.h',
    sourceLine: 45,
  },
  {
    name: 'HEVC_DECODER',
    module: 'ekernal',
    type: 'DEFINITION',
    mappedTo: [
      { module: 'epress', option: 'ENABLE_HLS_STREAMING', relation: 'parent' },
      { module: 'ekernal', option: 'AV1_DECODER', relation: 'sibling' },
      { module: 'ekernal', option: 'VP9_DECODER', relation: 'sibling' },
      { module: 'loader', option: 'OTA_UPDATE', relation: 'child' },
    ],
    groups: ['Codec Support'],
    sourceFile: 'decoder_config.h',
    sourceLine: 89,
  },
  {
    name: 'DOLBY_AUDIO',
    module: 'eintr',
    type: 'DEFINITION',
    mappedTo: [
      { module: 'eintr', option: 'DTS_AUDIO', relation: 'sibling' },
      { module: 'epress', option: 'ENABLE_PVR_RECORDING', relation: 'parent' },
      { module: 'egos', option: 'HDMI_2_1_SUPPORT', relation: 'child' },
    ],
    groups: ['Audio Features'],
    sourceFile: 'audio_config.h',
    sourceLine: 22,
  },
];

interface MappedOption {
  module: string;
  option: string;
  relation: 'parent' | 'sibling' | 'child';
}

interface OptionMapping {
  name: string;
  module: string;
  type: string;
  mappedTo: MappedOption[];
  groups: string[];
  sourceFile: string;
  sourceLine: number;
}

function RelationIcon({ relation }: { relation: string }) {
  if (relation === 'parent') return <ArrowRight className="h-3 w-3 text-blue-400" />;
  if (relation === 'child') return <ArrowLeft className="h-3 w-3 text-green-400" />;
  return <ArrowUpDown className="h-3 w-3 text-amber-400" />;
}

function getRelationColor(r: string) {
  if (r === 'parent') return 'border-blue-500/30 bg-blue-500/5';
  if (r === 'child') return 'border-green-500/30 bg-green-500/5';
  return 'border-amber-500/30 bg-amber-500/5';
}

export default function OptionsViewer() {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedBuild, setSelectedBuild] = useState('');
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [expandedOption, setExpandedOption] = useState<string | null>(null);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

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

  const filteredMappings = useMemo(() => {
    let data = SAMPLE_MAPPINGS;
    if (filterModule !== 'all') data = data.filter(m => m.module === filterModule);
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.mappedTo.some(t => t.option.toLowerCase().includes(q))
      );
    }
    return data;
  }, [search, filterModule]);

  // Compute connected options for hover highlight (spider web effect)
  const connectedOptions = useMemo(() => {
    if (!hoveredOption) return new Set<string>();
    const connected = new Set<string>();
    SAMPLE_MAPPINGS.forEach(m => {
      if (m.name === hoveredOption) {
        m.mappedTo.forEach(t => connected.add(t.option));
      }
      if (m.mappedTo.some(t => t.option === hoveredOption)) {
        connected.add(m.name);
        m.mappedTo.forEach(t => connected.add(t.option));
      }
    });
    connected.add(hoveredOption);
    return connected;
  }, [hoveredOption]);

  const groupByModule = useMemo(() => {
    const groups: Record<string, OptionMapping[]> = {};
    filteredMappings.forEach(m => {
      if (!groups[m.module]) groups[m.module] = [];
      groups[m.module].push(m);
    });
    return groups;
  }, [filteredMappings]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" /> Options Viewer
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of individual options and their cross-module mappings — hover to see connections
        </p>
      </div>

      {/* Context Selectors */}
      <Card className="border-primary/20">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SearchableCombo value={selectedProject} onValueChange={v => { setSelectedProject(v); setSelectedModel(''); setSelectedBuild(''); }}
              options={(projects || []).map((p: any) => ({ value: p.id, label: p.name }))}
              placeholder="Project" icon={FolderOpen} label="Project" />
            <SearchableCombo value={selectedModel} onValueChange={v => { setSelectedModel(v); setSelectedBuild(''); }}
              options={stbModels.map((m: any) => ({ value: m.id, label: m.name }))}
              placeholder="STB Model" icon={Tv} label="STB Model" />
            <SearchableCombo value={selectedBuild} onValueChange={setSelectedBuild}
              options={builds.map((b: any) => ({ value: b.id, label: `${b.name} (${b.version || 'v1'})` }))}
              placeholder="Build" icon={Package} label="Build" />
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search options, mappings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          <Badge variant="outline" className={cn("cursor-pointer", filterModule === 'all' && 'bg-primary/10 text-primary')}
            onClick={() => setFilterModule('all')}>All</Badge>
          {MODULE_LIST.map(m => (
            <Badge key={m} variant="outline"
              className={cn("cursor-pointer", filterModule === m ? MODULE_COLORS[m] : 'opacity-60 hover:opacity-100')}
              onClick={() => setFilterModule(filterModule === m ? 'all' : m)}>{m}</Badge>
          ))}
        </div>
        <Badge variant="secondary" className="text-xs">
          <Network className="h-3 w-3 mr-1" /> {filteredMappings.length} options
        </Badge>
      </div>

      {/* Options Table with Accordion by Module */}
      <Accordion type="multiple" defaultValue={Object.keys(groupByModule)} className="space-y-3">
        {Object.entries(groupByModule).map(([mod, mappings]) => (
          <AccordionItem key={mod} value={mod} className="border rounded-lg">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs", MODULE_COLORS[mod] || '')}>{mod}</Badge>
                <span className="text-sm font-medium">{mappings.length} options</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {mappings.reduce((a, m) => a + m.mappedTo.length, 0)} total connections
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Option Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Groups</TableHead>
                    <TableHead className="text-center">Connections</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map(mapping => (
                    <>
                      <TableRow key={mapping.name}
                        className={cn(
                          "cursor-pointer transition-all",
                          expandedOption === mapping.name && 'bg-primary/5',
                          hoveredOption && connectedOptions.has(mapping.name) && hoveredOption !== mapping.name && 'bg-accent/50 ring-1 ring-primary/30',
                          hoveredOption === mapping.name && 'bg-primary/10'
                        )}
                        onClick={() => setExpandedOption(expandedOption === mapping.name ? null : mapping.name)}
                        onMouseEnter={() => setHoveredOption(mapping.name)}
                        onMouseLeave={() => setHoveredOption(null)}
                      >
                        <TableCell className="font-mono text-xs font-medium">{mapping.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{mapping.type}</Badge></TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{mapping.sourceFile}:{mapping.sourceLine}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">{mapping.groups.map(g => (
                            <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>
                          ))}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center justify-center gap-1">
                                  <Link2 className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs font-medium">{mapping.mappedTo.length}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {mapping.mappedTo.filter(t => t.relation === 'parent').length} parents,{' '}
                                  {mapping.mappedTo.filter(t => t.relation === 'sibling').length} siblings,{' '}
                                  {mapping.mappedTo.filter(t => t.relation === 'child').length} children
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-6 text-xs">{expandedOption === mapping.name ? 'Collapse' : 'Expand'}</Button>
                        </TableCell>
                      </TableRow>
                      {expandedOption === mapping.name && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Network className="h-3.5 w-3.5" /> Connection Map — {mapping.name}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Parents */}
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-blue-400 flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3" /> Parents ({mapping.mappedTo.filter(t => t.relation === 'parent').length})
                                  </p>
                                  {mapping.mappedTo.filter(t => t.relation === 'parent').map(t => (
                                    <div key={t.option}
                                      className={cn("p-2 rounded border text-xs font-mono transition-all", getRelationColor('parent'),
                                        hoveredOption === t.option && 'ring-2 ring-primary'
                                      )}
                                      onMouseEnter={() => setHoveredOption(t.option)}
                                      onMouseLeave={() => setHoveredOption(mapping.name)}>
                                      <Badge variant="outline" className={cn("text-[9px] mr-1", MODULE_COLORS[t.module] || '')}>{t.module}</Badge>
                                      {t.option}
                                    </div>
                                  ))}
                                  {mapping.mappedTo.filter(t => t.relation === 'parent').length === 0 && (
                                    <p className="text-[10px] text-muted-foreground italic">None</p>
                                  )}
                                </div>

                                {/* Siblings */}
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                                    <ArrowUpDown className="h-3 w-3" /> Siblings ({mapping.mappedTo.filter(t => t.relation === 'sibling').length})
                                  </p>
                                  {mapping.mappedTo.filter(t => t.relation === 'sibling').map(t => (
                                    <div key={t.option}
                                      className={cn("p-2 rounded border text-xs font-mono transition-all", getRelationColor('sibling'),
                                        hoveredOption === t.option && 'ring-2 ring-primary'
                                      )}
                                      onMouseEnter={() => setHoveredOption(t.option)}
                                      onMouseLeave={() => setHoveredOption(mapping.name)}>
                                      <Badge variant="outline" className={cn("text-[9px] mr-1", MODULE_COLORS[t.module] || '')}>{t.module}</Badge>
                                      {t.option}
                                    </div>
                                  ))}
                                  {mapping.mappedTo.filter(t => t.relation === 'sibling').length === 0 && (
                                    <p className="text-[10px] text-muted-foreground italic">None</p>
                                  )}
                                </div>

                                {/* Children */}
                                <div className="space-y-1">
                                  <p className="text-[10px] font-medium text-green-400 flex items-center gap-1">
                                    <ArrowLeft className="h-3 w-3" /> Children ({mapping.mappedTo.filter(t => t.relation === 'child').length})
                                  </p>
                                  {mapping.mappedTo.filter(t => t.relation === 'child').map(t => (
                                    <div key={t.option}
                                      className={cn("p-2 rounded border text-xs font-mono transition-all", getRelationColor('child'),
                                        hoveredOption === t.option && 'ring-2 ring-primary'
                                      )}
                                      onMouseEnter={() => setHoveredOption(t.option)}
                                      onMouseLeave={() => setHoveredOption(mapping.name)}>
                                      <Badge variant="outline" className={cn("text-[9px] mr-1", MODULE_COLORS[t.module] || '')}>{t.module}</Badge>
                                      {t.option}
                                    </div>
                                  ))}
                                  {mapping.mappedTo.filter(t => t.relation === 'child').length === 0 && (
                                    <p className="text-[10px] text-muted-foreground italic">None</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {filteredMappings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No options match your search</p>
        </div>
      )}
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
          <Command><CommandInput placeholder={`Search...`} /><CommandList><CommandEmpty>No results</CommandEmpty><CommandGroup>
            {options.map(o => (<CommandItem key={o.value} onSelect={() => { onValueChange(o.value); setOpen(false); }}>
              <Check className={cn("mr-2 h-3.5 w-3.5", value === o.value ? "opacity-100" : "opacity-0")} />{o.label}
            </CommandItem>))}
          </CommandGroup></CommandList></Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
