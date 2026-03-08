import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Trash2, Copy, Link2, Unlink, Eye, EyeOff, ToggleLeft,
  Zap, Sparkles, Clipboard, ExternalLink,
} from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { ConfigNodeData } from '@/types/configTypes';

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  nodeId: string | null;
}

interface NodeContextMenuProps {
  state: ContextMenuState;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onDelete: (nodeId: string) => void;
  onToggleIncluded: (nodeId: string) => void;
  onToggleVisible: (nodeId: string) => void;
  onFocusNode: (nodeId: string) => void;
  onShowInsights: (nodeId: string) => void;
  onDisconnectAll: (nodeId: string) => void;
  onCopyNodeId: (nodeId: string) => void;
}

const NodeContextMenu = ({
  state, nodes, edges, onClose, onDelete, onToggleIncluded,
  onToggleVisible, onFocusNode, onShowInsights, onDisconnectAll, onCopyNodeId,
}: NodeContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    if (state.show) {
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleClick);
    }
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleClick);
    };
  }, [state.show, onClose]);

  if (!state.show || !state.nodeId) return null;

  const node = nodes.find(n => n.id === state.nodeId);
  if (!node) return null;
  const data = node.data as unknown as ConfigNodeData;
  const isIncluded = data.properties?.included === true;
  const connectionCount = edges.filter(e => e.source === state.nodeId || e.target === state.nodeId).length;
  const deps = edges.filter(e => e.source === state.nodeId);
  const dependents = edges.filter(e => e.target === state.nodeId);

  const menuItems = [
    { label: isIncluded ? 'Exclude Node' : 'Include Node', icon: ToggleLeft, action: () => onToggleIncluded(state.nodeId!), className: '' },
    { label: data.visible ? 'Hide Node' : 'Show Node', icon: data.visible ? EyeOff : Eye, action: () => onToggleVisible(state.nodeId!), className: '' },
    { type: 'separator' as const },
    { label: `View Dependencies (${deps.length})`, icon: Link2, action: () => onShowInsights(state.nodeId!), className: '' },
    { label: `View Dependents (${dependents.length})`, icon: ExternalLink, action: () => onShowInsights(state.nodeId!), className: '' },
    { label: 'AI Insights', icon: Sparkles, action: () => onShowInsights(state.nodeId!), className: 'text-accent' },
    { type: 'separator' as const },
    { label: `Disconnect All (${connectionCount})`, icon: Unlink, action: () => onDisconnectAll(state.nodeId!), className: 'text-node-group', disabled: connectionCount === 0 },
    { label: 'Copy Node ID', icon: Clipboard, action: () => onCopyNodeId(state.nodeId!), className: '' },
    { type: 'separator' as const },
    { label: 'Delete Node', icon: Trash2, action: () => onDelete(state.nodeId!), className: 'text-destructive' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] bg-popover border border-border rounded-lg shadow-xl py-1.5 animate-in fade-in-0 zoom-in-95"
      style={{ left: state.x, top: state.y }}
    >
      <div className="px-3 py-1.5 border-b border-border mb-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{data.type}</p>
        <p className="text-xs font-semibold text-foreground truncate max-w-[180px]">{data.label}</p>
      </div>
      {menuItems.map((item, i) => {
        if ('type' in item && item.type === 'separator') {
          return <div key={i} className="h-px bg-border my-1 mx-2" />;
        }
        const { label, icon: Icon, action, className, disabled } = item as any;
        return (
          <button
            key={i}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); action(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default NodeContextMenu;
export type { ContextMenuState };
