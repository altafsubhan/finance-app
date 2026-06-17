'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

interface PeriodSummary {
  periodValue: number | null;
  budget: number;
  actual: number;
}

interface MonthlyHeroProps {
  monthlySummaries: PeriodSummary[];
  year: number;
  isShared: boolean;
}

const monthShort = (m: number) => new Date(2000, m - 1).toLocaleString('default', { month: 'short' });
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

export default function MonthlyHero({ monthlySummaries, year, isShared }: MonthlyHeroProps) {
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const currentMonth = isCurrentYear ? now.getMonth() + 1 : 12;

  const current = monthlySummaries?.[currentMonth - 1];
  const accent = isShared ? '#2563eb' : '#7c3aed';

  const projection = useMemo(() => {
    if (!current) return null;
    const daysInMonth = new Date(year, currentMonth, 0).getDate();
    const daysElapsed = isCurrentYear ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
    const projected = daysElapsed > 0 ? (current.actual / daysElapsed) * daysInMonth : current.actual;
    const overBudget = current.budget > 0 && projected > current.budget;
    return { projected, overBudget, daysElapsed, daysInMonth };
  }, [current, currentMonth, isCurrentYear, now, year]);

  const chartData = useMemo(() => {
    const start = Math.max(0, currentMonth - 6);
    return (monthlySummaries || [])
      .slice(start, currentMonth)
      .map((m) => ({
        month: monthShort(m.periodValue || 0),
        Budget: Math.round(m.budget),
        Spent: Math.round(m.actual),
      }));
  }, [monthlySummaries, currentMonth]);

  const remaining = current ? current.budget - current.actual : 0;

  return (
    <div className="bg-white border rounded-lg p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* This month at a glance */}
        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {monthShort(currentMonth)} {year} · this month
            </div>
            <div className="mt-1 text-3xl font-bold text-gray-900">
              {current ? formatCurrency(current.actual) : '—'}
            </div>
            <div className="text-sm text-gray-500">
              of {current ? formatCurrency(current.budget) : '—'} budget
            </div>
          </div>

          {current && current.budget > 0 && (
            <div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min((current.actual / current.budget) * 100, 100)}%`,
                    backgroundColor: remaining < 0 ? '#f43f5e' : accent,
                  }}
                />
              </div>
              <div className={`mt-1 text-sm ${remaining < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                {remaining < 0
                  ? `${formatCurrency(Math.abs(remaining))} over budget`
                  : `${formatCurrency(remaining)} remaining`}
              </div>
            </div>
          )}

          {projection && (
            <div className="rounded-lg border p-3 bg-gray-50">
              <div className="text-xs text-gray-500">Projected end of month</div>
              <div className={`text-lg font-semibold ${projection.overBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatCurrency(projection.projected)}
              </div>
              <div className="text-xs text-gray-400">
                Based on {projection.daysElapsed}/{projection.daysInMonth} days
                {projection.overBudget ? ' · trending over budget' : ' · on track'}
              </div>
            </div>
          )}
        </div>

        {/* Trend chart */}
        <div className="lg:col-span-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Last {chartData.length} months · budget vs spent
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Budget" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Spent" fill={accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
