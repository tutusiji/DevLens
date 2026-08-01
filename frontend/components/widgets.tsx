/**
 * 业务展示组件 v3.0 - Bento Grid 去框化风格
 * 增强动画：数字滚动 + 微光光晕 + stagger 入场
 * 视觉效果：语义色文字 + ScoreRing 发光效果
 */
'use client';

import * as React from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardAccent } from '@/components/ui/card';
import { cn, scoreColor } from '@/lib/utils';

// ============ CountUp 数字滚动动画 ============

export function CountUp({
  value,
  decimals = 0,
  duration = 0.8,
  suffix = '',
  glow = false,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  glow?: boolean;
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
    <span ref={ref} className={cn('tabular-nums', glow && 'glow-text')}>
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
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export const cardItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">{title}</h1>
        {description && <p className="text-sm sm:text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}

// ============ StatCard 统计卡片（带 count-up + 光晕效果） ============

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
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 shadow-lg shadow-primary/8">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-mono text-2xl sm:text-3xl font-bold text-primary">
          <CountUp value={value} decimals={isFloat ? 1 : 0} />
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', deltaColor)}>
        <DeltaIcon className="h-3.5 w-3.5" />
        <span className="tabular-nums">
          {isUp ? '+' : ''}
          {delta}
          {unit === '分' ? '分' : '%'}
        </span>
        <span className="text-muted-foreground/70">较上月</span>
      </div>
      {/* 迷你趋势条 */}
      {trend && trend.length > 1 && (
        <div className="mt-4 flex h-10 items-end gap-1.5">
          {trend.map((v, i) => {
            const max = Math.max(...trend);
            const min = Math.min(...trend);
            const range = max - min || 1;
            const h = 8 + ((v - min) / range) * 32;
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                className="flex-1 rounded-xl bg-primary/50 shadow-sm"
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============ ScoreRing 评分环（带入场动画 + 发光效果） ============

export function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  glow = true,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  glow?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = scoreColor(score);
  const ref = React.useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  const offset = circumference - (score / 100) * circumference;
  const initialOffset = circumference;

  const glowColor = color;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* 外层光晕（弱化） */}
      {glow && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 24px ${glowColor}25, 0 0 48px ${glowColor}10`,
          }}
        />
      )}
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        {/* 背景环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          opacity={0.2}
        />
        {/* 动画前景环 */}
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
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            filter: glow ? `drop-shadow(0 0 6px ${glowColor}40)` : undefined,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-xl sm:text-2xl font-bold" style={{ color, textShadow: glow ? `0 0 12px ${glowColor}30` : undefined }}>
          <CountUp value={Math.round(score)} duration={1.2} />
        </span>
        {label && <span className="mt-0.5 text-xs text-muted-foreground">{label}</span>}
        {sublabel && <span className="text-[10px] text-muted-foreground/70">{sublabel}</span>}
      </div>
    </div>
  );
}

// ============ ProgressBar 带标签进度条（纯色 + 发光） ============

export function ProgressBar({
  label,
  value,
  max = 100,
  showValue = true,
  unit = '%',
  indicatorClassName,
  glow = false,
}: {
  label?: string;
  value: number;
  max?: number;
  showValue?: boolean;
  unit?: string;
  indicatorClassName?: string;
  glow?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = indicatorClassName?.includes('success')
    ? 'var(--success)'
    : indicatorClassName?.includes('warning')
    ? 'var(--warning)'
    : indicatorClassName?.includes('destructive') || indicatorClassName?.includes('danger')
    ? 'var(--destructive)'
    : 'var(--primary)';

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          {showValue && (
            <span className="font-mono tabular-nums font-medium text-foreground">
              {value}
              {unit}
            </span>
          )}
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn('h-full rounded-full', indicatorClassName || 'bg-primary')}
          style={{
            boxShadow: glow ? `0 0 10px ${barColor}40` : undefined,
          }}
        />
      </div>
    </div>
  );
}

// ============ HeroStat 首页大数字展示 - Bento 风格 ============

export function HeroStat({
  value,
  label,
  unit,
  delta,
  icon: Icon,
  variant = 'primary',
}: {
  value: number;
  label: string;
  unit?: string;
  delta?: number;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'success' | 'warning' | 'accent';
}) {
  const textColorClass =
    variant === 'success'
      ? 'text-success'
      : variant === 'warning'
      ? 'text-warning'
      : variant === 'accent'
      ? 'text-accent'
      : 'text-primary';

  const isUp = delta && delta > 0;
  const isDown = delta && delta < 0;
  const deltaColor = isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground';
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <Card className="relative overflow-hidden p-6">
      {/* 背景装饰光晕 - 极简 */}
      <div
        className="absolute -right-12 -top-12 h-24 w-24 rounded-full opacity-10 blur-2xl"
        style={{
          background: variant === 'success' ? 'var(--success)' : variant === 'warning' ? 'var(--warning)' : 'var(--primary)',
        }}
      />

      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/10 shadow-lg shadow-primary/8">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      )}

      <div className="relative">
        <div className="flex items-baseline gap-1.5">
          <span className={cn('font-mono text-3xl sm:text-4xl font-bold', textColorClass)}>
            <CountUp value={value} glow />
          </span>
          {unit && <span className="text-base text-muted-foreground">{unit}</span>}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
        {delta !== undefined && (
          <div className={cn('mt-2.5 flex items-center gap-1 text-xs font-medium', deltaColor)}>
            <DeltaIcon className="h-4 w-4" />
            <span className="tabular-nums">
              {isUp ? '+' : ''}
              {delta}%
            </span>
            <span className="text-muted-foreground/70">较上月</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============ HealthHero 健康度主角区域 ============

export function HealthHero({
  score,
  trend,
  target = 85,
}: {
  score: number;
  trend?: number;
  target?: number;
}) {
  const color = scoreColor(score);
  const isUp = trend && trend > 0;
  const isDown = trend && trend < 0;

  return (
    <CardAccent className="flex h-full flex-col items-center justify-center p-6 sm:p-8">
      {/* 背景装饰 - 极简微光 */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full">
        <div className="mb-4 sm:mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-secondary/10">
            <svg className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-sm sm:text-base font-medium text-muted-foreground">组织健康度</span>
        </div>

        {/* 超大数字展示 */}
        <div className="relative">
          <span
            className="font-mono hero-number"
            style={{ color, textShadow: `0 0 32px ${color}30` }}
          >
            <CountUp value={Math.round(score)} duration={1.5} />
          </span>
          <span className="absolute -right-6 top-0 text-xl font-bold text-muted-foreground/40">.0</span>
        </div>

        <div className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm">
          <div className="flex items-center gap-2">
            {isUp ? (
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
            ) : isDown ? (
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            ) : (
              <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            )}
            <span className={cn('font-mono tabular-nums font-medium', isUp ? 'text-success' : isDown ? 'text-destructive' : 'text-muted-foreground')}>
              {isUp ? '+' : ''}{trend || 0}%
            </span>
            <span className="text-muted-foreground/70">较上月</span>
          </div>
          <div className="h-4 w-px bg-border/50 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground/70">目标</span>
            <span className="font-mono tabular-nums font-medium">{target}</span>
          </div>
        </div>

        <div className="mt-5 sm:mt-6 w-full max-w-xs">
          <ProgressBar
            value={score}
            max={100}
            showValue={false}
            indicatorClassName={score >= 85 ? 'bg-success' : score >= 70 ? 'bg-warning' : 'bg-destructive'}
            glow
          />
          <div className="mt-2.5 flex justify-between text-xs text-muted-foreground/70">
            <span>当前 {score.toFixed(1)}</span>
            <span>目标 {target}</span>
          </div>
        </div>
      </div>
    </CardAccent>
  );
}
