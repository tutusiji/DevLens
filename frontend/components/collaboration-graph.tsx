/**
 * CollaborationGraph - 协作网络图
 * SVG 交互式图谱，展示开发者与协作伙伴之间的关系
 * 借鉴 engi-intel-v2 的协作网络图概念
 *
 * 中心节点 = 当前开发者
 * 外围节点 = 协作伙伴
 * 边的粗细 = 共改提交数 + 互评次数
 * 节点大小 = 协作强度
 */
'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export interface CollabNode {
  id: string;
  name: string;
  username: string;
  sharedCommits: number;
  reviewCount: number;
  isCenter?: boolean;
}

interface CollaborationGraphProps {
  center: { name: string; username: string };
  partners: CollabNode[];
  developerIdMap?: Record<string, string>; // username -> developer page id
}

export function CollaborationGraph({ center, partners, developerIdMap = {} }: CollaborationGraphProps) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  // 图谱参数
  const W = 480;
  const H = 340;
  const cx = W / 2;
  const cy = H / 2;
  const radius = 120; // 外围节点分布半径
  const centerR = 32; // 中心节点半径
  const minNodeR = 18; // 最小外围节点半径
  const maxNodeR = 28; // 最大外围节点半径

  // 计算协作强度，用于决定节点大小和边粗细
  const maxIntensity = Math.max(...partners.map((p) => p.sharedCommits + p.reviewCount), 1);

  // 外围节点位置
  const nodes = partners.map((p, i) => {
    const angle = (i / partners.length) * Math.PI * 2 - Math.PI / 2; // 从顶部开始
    const intensity = (p.sharedCommits + p.reviewCount) / maxIntensity;
    const r = minNodeR + (maxNodeR - minNodeR) * intensity;
    return {
      ...p,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r,
      intensity,
      angle,
    };
  });

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 340 }}
      >
        <defs>
          {/* 中心节点渐变 */}
          <radialGradient id="centerGrad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="oklch(0.72 0.19 250)" />
            <stop offset="100%" stopColor="oklch(0.55 0.2 265)" />
          </radialGradient>
          {/* 外围节点渐变 */}
          <radialGradient id="nodeGrad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="oklch(0.68 0.15 200)" />
            <stop offset="100%" stopColor="oklch(0.5 0.12 220)" />
          </radialGradient>
          <radialGradient id="nodeGradHover" cx="35%" cy="35%">
            <stop offset="0%" stopColor="oklch(0.75 0.18 78)" />
            <stop offset="100%" stopColor="oklch(0.6 0.15 90)" />
          </radialGradient>
          {/* 边渐变 */}
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="color-mix(in oklch, var(--primary) 40%, transparent)" />
            <stop offset="100%" stopColor="color-mix(in oklch, var(--secondary) 40%, transparent)" />
          </linearGradient>
        </defs>

        {/* 连接线 */}
        {nodes.map((node, i) => {
          const strokeWidth = 1 + node.intensity * 3;
          const isHovered = hoveredIdx === i;
          const isDimmed = hoveredIdx !== null && hoveredIdx !== i;
          return (
            <line
              key={`edge-${i}`}
              x1={cx}
              y1={cy}
              x2={node.x}
              y2={node.y}
              stroke={isHovered ? 'var(--accent)' : 'url(#edgeGrad)'}
              strokeWidth={isHovered ? strokeWidth + 1 : strokeWidth}
              strokeDasharray={isDimmed ? '4 4' : 'none'}
              opacity={isDimmed ? 0.2 : isHovered ? 0.9 : 0.5}
              style={{ transition: 'all 0.2s ease' }}
            />
          );
        })}

        {/* 外围节点 */}
        {nodes.map((node, i) => {
          const isHovered = hoveredIdx === i;
          const isDimmed = hoveredIdx !== null && hoveredIdx !== i;
          const targetId = developerIdMap[node.username] || '';
          return (
            <g
              key={`node-${i}`}
              style={{ cursor: targetId ? 'pointer' : 'default', opacity: isDimmed ? 0.4 : 1, transition: 'opacity 0.2s ease' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* 光晕（hover 时显示） */}
              {isHovered && (
                <circle cx={node.x} cy={node.y} r={node.r + 6} fill="var(--accent)" opacity={0.12} />
              )}
              {/* 节点圆 */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.r}
                fill={isHovered ? 'url(#nodeGradHover)' : 'url(#nodeGrad)'}
                stroke={isHovered ? 'var(--accent)' : 'color-mix(in oklch, var(--primary) 30%, transparent)'}
                strokeWidth={1.5}
                style={{ transition: 'all 0.2s ease' }}
              />
              {/* 首字母 */}
              <text
                x={node.x}
                y={node.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={13}
                fontWeight={600}
                style={{ pointerEvents: 'none', fontFamily: 'var(--font-fira-sans), sans-serif' }}
              >
                {node.name[0]}
              </text>
              {/* 名称标签 */}
              <text
                x={node.x}
                y={node.y + node.r + 14}
                textAnchor="middle"
                fill="var(--muted-foreground)"
                fontSize={11}
                style={{ pointerEvents: 'none', fontFamily: 'var(--font-fira-sans), sans-serif' }}
              >
                {node.name}
              </text>
              {/* 协作数标签（hover 时显示） */}
              {isHovered && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={node.x - 52}
                    y={node.y - node.r - 28}
                    width={104}
                    height={20}
                    rx={10}
                    fill="var(--card)"
                    stroke="color-mix(in oklch, var(--accent) 30%, transparent)"
                    strokeWidth={1}
                  />
                  <text
                    x={node.x}
                    y={node.y - node.r - 14}
                    textAnchor="middle"
                    fill="var(--foreground)"
                    fontSize={10}
                    style={{ fontFamily: 'var(--font-fira-code), monospace' }}
                  >
                    {node.sharedCommits} 共改 · {node.reviewCount} 互评
                  </text>
                </g>
              )}
              {/* 点击区域（覆盖整个节点 + 标签） */}
              {targetId && (
                <a href={`/developers/${targetId}`} style={{ cursor: 'pointer' }}>
                  <circle cx={node.x} cy={node.y} r={node.r + 18} fill="transparent" />
                </a>
              )}
            </g>
          );
        })}

        {/* 中心节点 */}
        <g>
          {/* 脉冲光环 */}
          <circle cx={cx} cy={cy} r={centerR + 8} fill="none" stroke="var(--primary)" strokeWidth={1} opacity={0.15}>
            <animate attributeName="r" values={`${centerR + 6};${centerR + 14};${centerR + 6}`} dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.05;0.2" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={centerR} fill="url(#centerGrad)" stroke="var(--primary)" strokeWidth={2} />
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={16}
            fontWeight={700}
            style={{ pointerEvents: 'none', fontFamily: 'var(--font-fira-sans), sans-serif' }}
          >
            {center.name[0]}
          </text>
          <text
            x={cx}
            y={cy + centerR + 16}
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize={12}
            fontWeight={600}
            style={{ pointerEvents: 'none', fontFamily: 'var(--font-fira-sans), sans-serif' }}
          >
            {center.name}
          </text>
        </g>
      </svg>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'url(#centerGrad)' }} />
          当前开发者
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'oklch(0.6 0.12 220)' }} />
          协作伙伴
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: 'var(--accent)' }} />
          协作强度
        </span>
      </div>
    </div>
  );
}
