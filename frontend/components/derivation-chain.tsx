/**
 * 推导链 (Derivation Chain)
 * 可视化展示 DevLens 的核心方法论：
 * 项目事实 → 人员推导 → 团队聚合 → 管理决策
 * 借鉴 engi-intel-v2 的推导链概念，用横向流程图展示数据到决策的推导路径
 */
'use client';

import { motion } from 'framer-motion';
import { GitBranch, UserCog, Users, Lightbulb, ArrowRight } from 'lucide-react';

const STAGES = [
  {
    num: '01',
    icon: GitBranch,
    title: '项目事实',
    subtitle: 'Project Facts',
    desc: 'Git 提交、MR、Issue、CI/CD 流水线等原始数据',
    color: 'var(--primary)',
    bg: 'color-mix(in oklch, var(--primary) 12%, transparent)',
    border: 'color-mix(in oklch, var(--primary) 25%, transparent)',
  },
  {
    num: '02',
    icon: UserCog,
    title: '人员推导',
    subtitle: 'People Inference',
    desc: '从代码行为推导开发者能力向量与成长轨迹',
    color: 'var(--accent)',
    bg: 'color-mix(in oklch, var(--accent) 12%, transparent)',
    border: 'color-mix(in oklch, var(--accent) 25%, transparent)',
  },
  {
    num: '03',
    icon: Users,
    title: '团队聚合',
    subtitle: 'Team Aggregation',
    desc: 'Bus Factor、能力缺口、协作网络等团队级指标',
    color: 'var(--chart-2)',
    bg: 'color-mix(in oklch, var(--chart-2) 10%, var(--card))',
    border: 'color-mix(in oklch, var(--chart-2) 32%, var(--border))',
    pattern: 'network',
  },
  {
    num: '04',
    icon: Lightbulb,
    title: '管理决策',
    subtitle: 'Decision Support',
    desc: '风险预警、资源调配、人才培养等管理洞察',
    color: 'var(--success)',
    bg: 'color-mix(in oklch, var(--success) 12%, transparent)',
    border: 'color-mix(in oklch, var(--success) 25%, transparent)',
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

function TeamNetworkPattern() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 120"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0 right-0 h-full w-[68%] text-[var(--chart-2)] opacity-[0.16]"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M34 68L88 34L142 54L202 22" />
        <path d="M34 68L98 91L142 54L221 88" />
        <path d="M88 34L98 91" />
        <path d="M142 54L176 104" />
        <path d="M202 22L221 88" />
      </g>
      <g fill="currentColor">
        <circle cx="34" cy="68" r="4" />
        <circle cx="88" cy="34" r="3" />
        <circle cx="98" cy="91" r="3" />
        <circle cx="142" cy="54" r="5" />
        <circle cx="176" cy="104" r="3" />
        <circle cx="202" cy="22" r="3" />
        <circle cx="221" cy="88" r="4" />
      </g>
    </svg>
  );
}

export function DerivationChain() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative mb-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isLast = idx === STAGES.length - 1;
          return (
            <motion.div key={stage.num} variants={itemVariants} className="flex flex-1 items-center">
              {/* 阶段卡片 */}
              <div
                className="group relative flex-1 overflow-hidden rounded-lg border-l-[3px] p-4 transition-[border-color,box-shadow] duration-200 hover:shadow-sm"
                style={{
                  background: stage.bg,
                  borderColor: stage.border,
                  borderLeftColor: stage.color,
                }}
              >
                {stage.pattern === 'network' && <TeamNetworkPattern />}
                {/* 编号水印 */}
                <span
                  className="absolute right-2 top-1 font-mono text-3xl font-bold opacity-[0.1] select-none"
                  style={{ color: stage.color }}
                >
                  {stage.num}
                </span>

                <div className="relative flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200 group-hover:bg-card"
                    style={{ background: `color-mix(in oklch, ${stage.color} 18%, transparent)` }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: stage.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">{stage.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">{stage.subtitle}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {stage.desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* 连接箭头 */}
              {!isLast && (
                <div className="flex shrink-0 items-center justify-center px-2 lg:px-3">
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + idx * 0.12, duration: 0.3 }}
                    className="flex items-center gap-0.5"
                  >
                    <div
                      className="h-px w-4 lg:w-6"
                      style={{
                        background: `linear-gradient(to right, ${stage.border}, color-mix(in oklch, ${STAGES[idx + 1].color} 25%, transparent))`,
                      }}
                    />
                    <ArrowRight
                      className="h-3.5 w-3.5"
                      style={{ color: `color-mix(in oklch, ${stage.color} 50%, ${STAGES[idx + 1].color} 50%)` }}
                    />
                  </motion.div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
