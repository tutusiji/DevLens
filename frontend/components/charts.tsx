/**
 * recharts 图表组件 v2.0 - Glassmorphism Dark
 * 增强渐变填充、发光效果、网格线透明度优化
 */
'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring, useTransform, useInView } from 'framer-motion';
import { scoreColor } from '@/lib/utils';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/* 统一样式常量 - 去框化 + 高对比度 */
const axisStyle = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
  fontFamily: 'var(--font-mono)',
};

/* Glassmorphism Tooltip 样式 */
const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: 'none',
  borderRadius: '16px',
  fontSize: 12,
  color: 'var(--popover-foreground)',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
  backdropFilter: 'blur(20px)',
  padding: '12px 16px',
};

/* 极淡虚线网格 - 去框化核心 */
const gridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '4 4',
  vertical: false as const,
  opacity: 0.4,
};

/* 用宽松类型，兼容各种 data shape */
type ChartData = Record<string, any>[];

// ============ CapabilityRadar 能力雷达图（增强版） ============

export interface RadarSeries {
  name: string;
  data: Record<string, number>;
  color: string;
}

export function CapabilityRadar({
  series,
  height = 280,
}: {
  series: RadarSeries[];
  height?: number;
}) {
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
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="var(--muted-foreground)" strokeOpacity={0.15} />
        <PolarAngleAxis
          dataKey="dim"
          tick={{ ...axisStyle, fill: 'var(--muted-foreground)', fontWeight: 500 }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {series.map((s, i) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.15 + i * 0.05}
            strokeWidth={2.5}
            strokeDasharray={i > 0 ? '5 3' : undefined}
          />
        ))}
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: '16px' }} />
        )}
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ============ AreaTrend 区域趋势图（增强渐变 + 发光） ============

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
      <AreaChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
          {/* 发光滤镜 */}
          {series.map((s) => (
            <filter key={`glow-${s.key}`} id={`glow-${s.key}`}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: '16px' }} />
        )}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            fill={`url(#grad-${s.key})`}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0, fill: s.color }}
            filter={`url(#glow-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============ LineTrend 折线趋势图（成长曲线，增强点发光） ============

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
      <LineChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
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
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? '5 3' : undefined}
            dot={{ r: 4, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 7, strokeWidth: 0, fill: s.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============ GroupedBars 分组柱状图（渐变填充） ============

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
      <BarChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-muted)', opacity: 0.2 }} />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: '16px' }} />
        )}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[6, 6, 0, 0]}
            barSize={24}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============ Donut 环形图（Glassmorphism 风格边框） ============

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
          innerRadius="62%"
          outerRadius="85%"
          paddingAngle={3}
          stroke="var(--background)"
          strokeWidth={3}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: '16px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ============ ScoreGauge 仪表盘评分 ============

export function ScoreGauge({
  value,
  max = 100,
  label,
  color,
}: {
  value: number;
  max?: number;
  label?: string;
  color?: string;
}) {
  const percentage = Math.min(100, (value / max) * 100);
  const strokeColor = color || scoreColor(value);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width="120" height="70" viewBox="0 0 120 60">
        <defs>
          <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={1} />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* 背景弧线 */}
        <path
          d="M 10 55 A 50 50 0 0 1 110 55"
          fill="none"
          stroke="var(--surface-muted)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={0.3}
        />
        {/* 前景弧线动画 */}
        <motion.path
          d="M 10 55 A 50 50 0 0 1 110 55"
          fill="none"
          stroke="url(#gauge-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: percentage / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          filter="url(#gauge-glow)"
        />
      </svg>
      <div className="absolute bottom-2 flex flex-col items-center">
        <span className="font-mono text-2xl font-bold" style={{ color: strokeColor }}>
          <CountUp value={Math.round(value)} />
        </span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

/* 内部 CountUp 用于图表 */
function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1200, bounce: 0 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));

  React.useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span className="tabular-nums">{display}</motion.span>;
}
