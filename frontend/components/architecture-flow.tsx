'use client';

import * as React from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  MarkerType,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import ELK from 'elkjs/lib/elk.bundled.js';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
import type { ArchitectureComponent, ArchitectureDesign } from '@/lib/types';

const LAYER_COLORS: Record<string, string> = {
  edge: '#2563eb',
  service: '#0f766e',
  data: '#b45309',
  infra: '#7c3aed',
};

const LAYER_LABELS: Record<string, string> = {
  edge: '接入层',
  service: '服务层',
  data: '数据层',
  infra: '基础设施',
};

type ArchitectureNodeData = {
  component: ArchitectureComponent;
  color: string;
};

type ArchitectureNode = Node<ArchitectureNodeData, 'architecture'>;

function healthTone(health: number) {
  if (health >= 85) return 'var(--success)';
  if (health >= 70) return 'var(--warning)';
  return 'var(--destructive)';
}

function ArchitectureNodeView({ data, selected }: NodeProps<ArchitectureNode>) {
  const { component, color } = data;
  return (
    <div
      className="architecture-flow-node min-w-[188px] max-w-[230px] rounded-lg border bg-card p-3 shadow-sm"
      style={{ borderColor: selected ? 'var(--primary)' : 'var(--border)', boxShadow: selected ? '0 0 0 2px color-mix(in oklch, var(--primary) 18%, transparent)' : undefined }}
      tabIndex={0}
      aria-label={`${component.layerLabel}：${component.name}，健康度 ${component.health}，问题 ${component.issueCount} 项`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-card" style={{ background: color }} />
      <div className="flex items-start gap-2">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>{component.layerLabel || LAYER_LABELS[component.layer] || component.layer}</div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground" title={component.name}>{component.name}</div>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{component.description || '暂无组件说明'}</p>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px]">
        <span className="font-mono font-semibold" style={{ color: healthTone(component.health) }}>健康 {component.health}</span>
        <Badge variant={component.issueCount > 0 ? 'warning' : 'secondary'} className="text-[10px]">{component.issueCount} 项问题</Badge>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-card" style={{ background: color }} />
    </div>
  );
}

const nodeTypes = { architecture: ArchitectureNodeView };

function buildInitialNodes(design: ArchitectureDesign): ArchitectureNode[] {
  return design.components.map((component) => ({
    id: component.id,
    type: 'architecture',
    position: { x: 0, y: 0 },
      data: { component, color: LAYER_COLORS[component.layer] || 'var(--primary)' },
  }));
}

function buildEdges(design: ArchitectureDesign): Edge[] {
  return design.relations.map((relation, index) => ({
    id: `architecture-relation-${relation.source}-${relation.target}-${index}`,
    source: relation.source,
    target: relation.target,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--muted-foreground)' },
    style: { stroke: 'var(--muted-foreground)', strokeWidth: 1.5 },
  }));
}

async function layoutNodes(nodes: ArchitectureNode[], edges: Edge[]) {
  const elk = new ELK();
  const graph = {
    id: 'architecture-flow',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.spacing.nodeNode': '28',
      'elk.padding': '[top=32,left=36,bottom=32,right=36]',
    },
    children: nodes.map((node) => ({ id: node.id, width: 230, height: 142 })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  };
  const result = await elk.layout(graph);
  const positions = new Map((result.children || []).map((child) => [child.id, { x: child.x || 0, y: child.y || 0 }]));
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) || { x: 0, y: 0 } }));
}

function FlowToolbar({ compact }: { compact: boolean }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
      <span className="hidden rounded-md border border-border bg-card/95 px-2 py-1 text-[11px] text-muted-foreground shadow-sm sm:inline">拖拽节点 · 空白处平移 · 滚轮缩放</span>
      <button type="button" onClick={() => fitView({ padding: 0.2, duration: 250 })} className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">适配</button>
      {!compact && <><button type="button" onClick={() => zoomOut({ duration: 150 })} aria-label="缩小架构图" className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">−</button><button type="button" onClick={() => zoomIn({ duration: 150 })} aria-label="放大架构图" className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">＋</button></>}
    </div>
  );
}

function ArchitectureFlowInner({ design, compact }: { design: ArchitectureDesign; compact: boolean }) {
  const initialNodes = React.useMemo(() => buildInitialNodes(design), [design]);
  const initialEdges = React.useMemo(() => buildEdges(design), [design]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchitectureNode>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  React.useEffect(() => {
    let cancelled = false;
    setNodes(initialNodes);
    layoutNodes(initialNodes, initialEdges).then((laidOut) => {
      if (!cancelled) {
        setNodes(laidOut);
        requestAnimationFrame(() => fitView({ padding: compact ? 0.12 : 0.18, duration: 250 }));
      }
    });
    return () => { cancelled = true; };
  }, [compact, fitView, initialEdges, initialNodes, setNodes]);

  return (
    <div className="architecture-flow relative overflow-hidden rounded-lg border border-border bg-background" style={{ height: compact ? 330 : 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.35}
        maxZoom={1.8}
        nodesConnectable={false}
        nodesDraggable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        aria-label="可交互架构分层图"
      >
        <Background gap={20} size={1} color="var(--border)" />
        <Controls showInteractive={false} position="bottom-right" />
        {!compact && <MiniMap pannable zoomable nodeColor={(node) => (node.data as ArchitectureNodeData)?.color || 'var(--primary)'} position="bottom-left" />}
        <FlowToolbar compact={compact} />
      </ReactFlow>
    </div>
  );
}

export function ArchitectureFlow({ design, compact = false }: { design: ArchitectureDesign; compact?: boolean }) {
  return (
    <ReactFlowProvider>
      <ArchitectureFlowInner design={design} compact={compact} />
    </ReactFlowProvider>
  );
}
