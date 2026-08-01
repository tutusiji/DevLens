import * as React from 'react';
import {
  Card as HeroUICard,
  CardContent as HeroUICardContent,
  CardDescription as HeroUICardDescription,
  CardFooter as HeroUICardFooter,
  CardHeader as HeroUICardHeader,
  CardTitle as HeroUICardTitle,
} from '@heroui/react/card';
import { cn } from '@/lib/utils';

/* ============================================
   Card 组件 - 基于 HeroUI Card
   保持原有导出 API，并保留 className 透传。
   HeroUI 3.2 的 CardContent 即内容区语义组件，
   对应设计中的 CardBody 映射。
   ============================================ */

type HeroUICardProps = React.ComponentProps<typeof HeroUICard>;
type HeroUICardHeaderProps = React.ComponentProps<typeof HeroUICardHeader>;
type HeroUICardTitleProps = React.ComponentProps<typeof HeroUICardTitle>;
type HeroUICardDescriptionProps = React.ComponentProps<typeof HeroUICardDescription>;
type HeroUICardContentProps = React.ComponentProps<typeof HeroUICardContent>;
type HeroUICardFooterProps = React.ComponentProps<typeof HeroUICardFooter>;

function Card({ className, ...props }: HeroUICardProps) {
  return <HeroUICard className={cn('rounded-2xl', className)} {...props} />;
}

/**
 * 兼容历史紧凑卡片导出。使用 HeroUI secondary 表面层，
 * 不再依赖旧的自写 bento-card 样式。
 */
function CardCompact({ className, ...props }: HeroUICardProps) {
  return <HeroUICard variant="secondary" className={cn('rounded-2xl', className)} {...props} />;
}

/**
 * 兼容历史强调卡片导出。使用 HeroUI tertiary 表面层，
 * 以纯色层级替换旧的渐变强调边框。
 */
function CardAccent({ className, ...props }: HeroUICardProps) {
  return <HeroUICard variant="tertiary" className={cn('rounded-2xl', className)} {...props} />;
}

function CardHeader({ className, ...props }: HeroUICardHeaderProps) {
  return <HeroUICardHeader className={className} {...props} />;
}

function CardTitle({ className, ...props }: HeroUICardTitleProps) {
  return <HeroUICardTitle className={className} {...props} />;
}

function CardDescription({ className, ...props }: HeroUICardDescriptionProps) {
  return <HeroUICardDescription className={className} {...props} />;
}

function CardContent({ className, ...props }: HeroUICardContentProps) {
  return <HeroUICardContent className={className} {...props} />;
}

function CardFooter({ className, ...props }: HeroUICardFooterProps) {
  return <HeroUICardFooter className={className} {...props} />;
}

export { Card, CardCompact, CardAccent, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
