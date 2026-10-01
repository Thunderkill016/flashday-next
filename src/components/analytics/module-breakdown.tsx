'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AnalyticsCardShell } from '@/components/analytics/analytics-card-shell';
import { pickLocale } from '@/lib/i18n/locale';
import { useI18n } from '@/lib/i18n/use-i18n';
import type { InterfaceLanguage } from '@/stores/language-store';

interface Props {
  data: { module: string; sessions: number; time: number }[];
}

const MODULE_COLORS: Record<string, string> = {
  listen: '#6366f1',
  speak: '#22c55e',
  read: '#f59e0b',
  write: '#8b5cf6',
};

function formatTime(ms: number, language: InterfaceLanguage): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return pickLocale(language, { en: `${mins}m`, vi: `${mins} phút`, zh: `${mins} 分钟` });
  const hrs = Math.floor(mins / 60);
  return pickLocale(language, {
    en: `${hrs}h ${mins % 60}m`,
    vi: `${hrs} giờ ${mins % 60} phút`,
    zh: `${hrs} 小时 ${mins % 60} 分钟`,
  });
}

export function ModuleBreakdown({ data }: Props) {
  const { interfaceLanguage, messages } = useI18n('analytics');
  const copy = messages.charts.moduleBreakdown;
  const moduleLabels = messages.modules;

  return (
    <AnalyticsCardShell title={copy.title}>
      <>
        {data.length === 0 ? (
          <p className="text-sm text-indigo-400 py-8 text-center">{copy.empty}</p>
        ) : (
          <div className="flex items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="sessions"
                  nameKey="module"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.module} fill={MODULE_COLORS[entry.module] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={
                    ((value: number, name: string, props: { payload: { time: number } }) => [
                      copy.tooltipValue
                        .replace('{{count}}', String(value))
                        .replace('{{time}}', formatTime(props.payload.time, interfaceLanguage)),
                      moduleLabels[name as keyof typeof moduleLabels],
                    ]) as never
                  }
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value) => moduleLabels[value as keyof typeof moduleLabels]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </>
    </AnalyticsCardShell>
  );
}
