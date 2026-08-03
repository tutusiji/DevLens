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
    title: '团队能力合成',
    subtitle: 'Team Synthesis',
    desc: '成员能力叠加、结构完整性与知识覆盖等团队能力指标',
    color: 'var(--warning)',
    bg: 'color-mix(in oklch, var(--warning) 12%, transparent)',
    border: 'color-mix(in oklch, var(--warning) 25%, transparent)',
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

export function DerivationChain() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative mb-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isLast = idx === STAGES.length - 1;
          return (
            <motion.div key={stage.num} variants={itemVariants} className="flex flex-1 items-center">
              {/* 阶段卡片 */}
              <div
                className="group relative flex-1 overflow-hidden rounded-2xl p-3 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: stage.bg,
                  border: `1px solid ${stage.border}`,
                }}
              >
                {/* 编号水印 */}
                <span
                  className="absolute -right-1 -top-2 font-mono text-4xl font-bold opacity-8 select-none"
                  style={{ color: stage.color }}
                >
                  {stage.num}
                </span>

                <div className="relative flex items-start gap-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `color-mix(in oklch, ${stage.color} 18%, transparent)` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: stage.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">{stage.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/60">{stage.subtitle}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {stage.desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* 连接箭头 */}
              {!isLast && (
                <div className="flex shrink-0 items-center justify-center px-2 lg:px-2">
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
