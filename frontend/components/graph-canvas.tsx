'use client';

import { useState } from 'react';

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  color: string;
  label: string;
  sublabel?: string;
};

export type GraphLink = { source: string; target: string; weight?: number };

export function GraphCanvas({
  nodes,
  links,
  height = 420,
}: {
  nodes: GraphNode[];
  links: GraphLink[];
  height?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const isConnected = (id: string) => {
    if (!active) return true;
    if (id === active) return true;
    return links.some(
      (l) =>
        (l.source === active && l.target === id) ||
        (l.target === active && l.source === id),
    );
  };

  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {links.map((l, i) => {
          const s = byId[l.source];
          const t = byId[l.target];
          if (!s || !t) return null;
          const dim = active && !(l.source === active || l.target === active);
          return (
            <line
              key={i}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={dim ? 'var(--border)' : 'var(--primary)'}
              strokeOpacity={dim ? 0.25 : 0.4}
              strokeWidth={(l.weight ?? 1) * 0.25 + 0.15}
            />
          );
        })}
        {nodes.map((n) => {
          const r = (n.size ?? 16) / 8;
          const connected = isConnected(n.id);
          return (
            <g
              key={n.id}
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: 'pointer', opacity: connected ? 1 : 0.28, transition: 'opacity 0.2s' }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={r + (active === n.id ? 0.8 : 0)}
                fill={n.color}
                fillOpacity={0.18}
                stroke={n.color}
                strokeWidth={0.5}
                style={{ transition: 'r 0.15s' }}
              />
              <circle cx={n.x} cy={n.y} r={r * 0.4} fill={n.color} />
              <text
                x={n.x}
                y={n.y + r + 2.6}
                textAnchor="middle"
                style={{ fontSize: 2.4, fill: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}
              >
                {n.label}
              </text>
              {n.sublabel && (
                <text
                  x={n.x}
                  y={n.y + r + 5}
                  textAnchor="middle"
                  style={{ fontSize: 1.9, fill: 'var(--muted-foreground)' }}
                >
                  {n.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
