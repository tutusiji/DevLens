/**
 * 趋势预测卡片：历史观测 + 线性回归外推，虚线区分为预测区间
 */
'use client';

import * as React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaTrend } from '@/components/charts';
import type { ForecastPoint } from '@/lib/types';

const TREND_LABEL = { up: '↑ 上升', down: '↓ 下降', stable: '→ 持平' };

export function ForecastCard({
  projectId,
  observations,
  forecast,
  model,
}: {
  projectId: string;
  observations: ForecastPoint[];
  forecast: ForecastPoint[];
  model: string;
}) {
  const hasForecast = forecast.length > 0;
  const data: Array<Record<string, unknown>> = [
    ...observations.map((p) => ({ period: p.period, score: p.score })),
    ...forecast.map((p) => ({ period: p.period, score: p.score })),
  ];
  const lastObserved = observations[observations.length - 1]?.score ?? null;
  const firstForecast = forecast[0];

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            健康度趋势预测
          </CardTitle>
          <CardDescription>
            {hasForecast
              ? `基于 ${observations.length} 期历史快照外推 ${forecast.length} 期 · ${model === 'linear-regression' ? '线性回归' : '模型'}`
              : '历史数据不足，暂无法建模预测（至少需 2 期快照）'}
          </CardDescription>
        </div>
        {firstForecast && (
          <Badge variant={firstForecast.trend === 'down' ? 'warning' : firstForecast.trend === 'up' ? 'success' : 'secondary'}>
            {TREND_LABEL[firstForecast.trend ?? 'stable']}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <AreaTrend
          data={data}
          xKey="period"
          series={[{ key: 'score', name: '健康度', color: 'var(--chart-1)' }]}
          height={200}
        />
        {hasForecast && lastObserved !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            当前 {lastObserved} 分，{forecast.length} 期后预计
            <span className="mx-1 font-mono font-semibold" style={{ color: firstForecast!.trend === 'down' ? 'var(--destructive)' : firstForecast!.trend === 'up' ? 'var(--success)' : 'var(--muted-foreground)' }}>
              {forecast[forecast.length - 1].score} 分
            </span>
            （虚线为预测区间）
          </p>
        )}
      </CardContent>
    </Card>
  );
}
