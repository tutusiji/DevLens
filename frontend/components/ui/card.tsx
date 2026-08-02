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

type HeroUICardProps = React.ComponentProps<typeof HeroUICard>;
type HeroUICardHeaderProps = React.ComponentProps<typeof HeroUICardHeader>;
type HeroUICardTitleProps = React.ComponentProps<typeof HeroUICardTitle>;
type HeroUICardDescriptionProps = React.ComponentProps<typeof HeroUICardDescription>;
type HeroUICardContentProps = React.ComponentProps<typeof HeroUICardContent>;
type HeroUICardFooterProps = React.ComponentProps<typeof HeroUICardFooter>;

function Card({ className, ...props }: HeroUICardProps) {
  return <HeroUICard className={cn('rounded-md border border-border bg-card shadow-none', className)} {...props} />;
}

function CardCompact({ className, ...props }: HeroUICardProps) {
  return <HeroUICard variant="secondary" className={cn('rounded-md border border-border bg-muted shadow-none', className)} {...props} />;
}

function CardAccent({ className, ...props }: HeroUICardProps) {
  return <HeroUICard variant="tertiary" className={cn('rounded-md border border-primary/30 bg-card shadow-none', className)} {...props} />;
}

function CardHeader({ className, ...props }: HeroUICardHeaderProps) {
  return <HeroUICardHeader className={cn('border-b border-border px-4 py-3', className)} {...props} />;
}

function CardTitle({ className, ...props }: HeroUICardTitleProps) {
  return <HeroUICardTitle className={cn('text-sm font-semibold tracking-tight', className)} {...props} />;
}

function CardDescription({ className, ...props }: HeroUICardDescriptionProps) {
  return <HeroUICardDescription className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: HeroUICardContentProps) {
  return <HeroUICardContent className={cn('px-4 py-4', className)} {...props} />;
}

function CardFooter({ className, ...props }: HeroUICardFooterProps) {
  return <HeroUICardFooter className={cn('border-t border-border px-4 py-3', className)} {...props} />;
}

export { Card, CardCompact, CardAccent, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
