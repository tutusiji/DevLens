/**
 * 业务展示组件：PageHeader / StatCard / ScoreRing / ProgressBar / CountUp / MotionCard
 * 含 framer-motion 动画：数字 count-up、ScoreRing 入场、卡片 stagger
 */
'use client';

import * as React from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, scoreColor } from '@/lib/utils';

// ============ CountUp 数字滚动动画 ============

export function CountUp({
  value,
  decimals = 0,
  duration = 0.8,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(spring, (v) => v.toFixed(decimals));

  React.useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

// ============ MotionCard 带入场动画的卡片 ============

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const cardItem: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

export function MotionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={cardItem}>
      <Card className={className}>{children}</Card>
    </motion.div>
  );
}

// ============ PageHeader 页面标题区 ============

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 flex items-start justify-between gap-4"
    >
      <div className="space-y-1">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

// ============ StatCard 统计卡片（带 count-up）============

export function StatCard({
  label,
  value,
  unit,
  delta,
  trend,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit?: string;
  delta: number;
  trend?: number[];
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const isUp = delta > 0;
  const isDown = delta < 0;
  const deltaColor = isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground';
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const isFloat = !Number.isInteger(value);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-3xl font-semibold">
          <CountUp value={value} decimals={isFloat ? 1 : 0} />
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', deltaColor)}>
        <DeltaIcon className="h-3 w-3" />
        <span className="tabular-nums">
          {isUp ? '+' : ''}
          {delta}
          {unit === '分' ? '分' : '%'}
        </span>
        <span className="text-muted-foreground">较上月</span>
      </div>
      {/* 迷你趋势条 */}
      {trend && trend.length > 1 && (
        <div className="mt-3 flex h-8 items-end gap-1">
          {trend.map((v, i) => {
            const max = Math.max(...trend);
            const min = Math.min(...trend);
            const range = max - min || 1;
            const h = 8 + ((v - min) / range) * 24;
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: 'easeOut' }}
                className="flex-1 rounded-sm bg-primary/30 transition-colors hover:bg-primary/60"
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============ ScoreRing 评分环（带入场动画）============

export function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  label,
  sublabel,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(score);
  const ref = React.useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  // 从满偏移（空环）动画到目标偏移
  const offset = circumference - (score / 100) * circumference;
  const initialOffset = circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: initialOffset }}
          animate={{ strokeDashoffset: inView ? offset : initialOffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-2xl font-bold" style={{ color }}>
          <CountUp value={Math.round(score)} duration={1} />
        </span>
        {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
        {sublabel && <span className="text-[10px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}

// ============ ProgressBar 带标签进度条 ============

export function ProgressBar({
  label,
  value,
  max = 100,
  showValue = true,
  unit = '%',
  indicatorClassName,
}: {
  label?: string;
  value: number;
  max?: number;
  showValue?: boolean;
  unit?: string;
  indicatorClassName?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          {showValue && (
            <span className="font-mono tabular-nums text-foreground">
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', indicatorClassName || 'bg-primary')}
        />
      </div>
    </div>
  );
}
