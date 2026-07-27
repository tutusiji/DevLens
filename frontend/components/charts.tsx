/**
 * recharts 图表封装
 * 5 个核心图表：CapabilityRadar / AreaTrend / LineTrend / GroupedBars / Donut
 * 统一暗色主题、网格线虚线低对比、tooltip popover 风格
 */
'use client';

import * as React from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// 统一样式常量
const axisStyle = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
  fontFamily: 'var(--font-mono)',
};

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: 12,
  color: 'var(--popover-foreground)',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.4)',
};

const gridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  vertical: false as const,
};

// 用宽松类型，兼容各种 data shape（接口对象、Record 等）
type ChartData = Record<string, any>[];

// ============ CapabilityRadar 能力雷达图 ============

export interface RadarSeries {
  name: string;
  data: Record<string, number>; // { 维度名: 分值 }
  color: string;
}

export function CapabilityRadar({
  series,
  height = 280,
}: {
  series: RadarSeries[];
  height?: number;
}) {
  // 把多 series 数据合并成 recharts 需要的格式
  const dimensions = Object.keys(series[0]?.data || {});
  const data = dimensions.map((dim) => {
    const row: Record<string, string | number> = { dim };
    series.forEach((s) => {
      row[s.name] = s.data[dim] || 0;
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {series.map((s, i) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.2}
            strokeWidth={2}
            strokeDasharray={i > 0 ? '5 3' : undefined} // 多 series 用虚线区分（不只靠颜色）
          />
        ))}
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ============ AreaTrend 区域趋势图 ============

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
  dashed?: boolean;
}

export function AreaTrend({
  data,
  xKey,
  series,
  height = 240,
}: {
  data: ChartData;
  xKey: string;
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
        )}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            fill={`url(#grad-${s.key})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============ LineTrend 折线趋势图（成长曲线） ============

export function LineTrend({
  data,
  xKey,
  series,
  height = 200,
}: {
  data: ChartData;
  xKey: string;
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            dot={{ r: 3, fill: s.color }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============ GroupedBars 分组柱状图 ============

export function GroupedBars({
  data,
  xKey,
  series,
  height = 240,
}: {
  data: ChartData;
  xKey: string;
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
        )}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============ Donut 环形图 ============

export function Donut({
  data,
  height = 200,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
