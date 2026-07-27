/**
 * 三位一体矩阵：团队 × 项目 交叉热力图
 * v2 缺失的核心组件，本次新增
 * 遵循 skill 规则：颜色不单独传达信息（每个单元格显示分数文字）+ 单元格 >=44px 可交互
 */
'use client';

import * as React from 'react';
import { scoreColor } from '@/lib/utils';
import type { TrinityMatrix as TrinityMatrixData } from '@/lib/types';

export function TrinityMatrix({
  data,
  onSelect,
}: {
  data: TrinityMatrixData;
  onSelect?: (team: string, project: string, score: number) => void;
}) {
  const [hovered, setHovered] = React.useState<{ r: number; c: number } | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-card p-2 text-left text-xs font-medium text-muted-foreground">
              团队 / 项目
            </th>
            {data.cols.map((col) => (
              <th
                key={col}
                className="min-w-[88px] p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={row}>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-card p-2 text-xs font-medium">
                {row}
              </td>
              {data.cols.map((_, ci) => {
                const cell = data.cells[ri]?.[ci];
                if (!cell) {
                  return (
                    <td
                      key={ci}
                      className="h-12 min-w-[88px] rounded-md border border-dashed border-border/30 bg-transparent"
                    >
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    </td>
                  );
                }
                const color = scoreColor(cell.score);
                const isHovered = hovered?.r === ri && hovered?.c === ci;
                return (
                  <td
                    key={ci}
                    onMouseEnter={() => setHovered({ r: ri, c: ci })}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelect?.(row, data.cols[ci], cell.score)}
                    className="group relative h-12 min-w-[88px] cursor-pointer rounded-md transition-all hover:scale-105 hover:shadow-lg"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${color} 25%, transparent)`,
                      border: `1px solid color-mix(in oklch, ${color} 50%, transparent)`,
                      outline: isHovered ? `2px solid ${color}` : 'none',
                      outlineOffset: '1px',
                    }}
                  >
                    <div className="flex h-full flex-col items-center justify-center">
                      <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
                        {cell.score}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {cell.members}人{cell.owner ? ` · ${cell.owner}` : ''}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>评分</span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ background: 'var(--success)' }} /> ≥85 优秀
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ background: 'var(--warning)' }} /> 70-85 良好
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ background: 'var(--destructive)' }} /> &lt;70 风险
        </span>
      </div>
    </div>
  );
}
