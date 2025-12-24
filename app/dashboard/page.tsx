'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SummaryItem {
  category_id: string;
  category_name: string;
  category_type: string;
  budget: number;
  actual: number;
  difference: number;
  transaction_count: number;
}

interface SummaryData {
  year: number;
  period: string;
  period_value: number | null;
  summary: SummaryItem[];
  totals: {
    budget: number;
    actual: number;
    difference: number;
  };
}

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('year');
  const [selectedPeriodValue, setSelectedPeriodValue] = useState<string>('');

  useEffect(() => {
    loadSummary();
  }, [selectedYear, selectedPeriod, selectedPeriodValue]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('year', selectedYear.toString());
      params.append('period', selectedPeriod);
      if (selectedPeriodValue) {
        params.append('period_value', selectedPeriodValue);
      }

      const response = await fetch(`/api/summary?${params.toString()}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSummaryData(data);
      }
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    if (selectedPeriod === 'year') {
      return `${selectedYear}`;
    } else if (selectedPeriod === 'quarter') {
      if (selectedPeriodValue) {
        const quarters = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
        return `${quarters[parseInt(selectedPeriodValue) - 1]} ${selectedYear}`;
      }
      return `All Quarters ${selectedYear}`;
    } else {
      if (selectedPeriodValue) {
        const monthName = new Date(2000, parseInt(selectedPeriodValue) - 1).toLocaleString('default', { month: 'long' });
        return `${monthName} ${selectedYear}`;
      }
      return `All Months ${selectedYear}`;
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Filter summary by category type
  const monthlyItems = summaryData?.summary.filter(s => s.category_type === 'monthly') || [];
  const quarterlyItems = summaryData?.summary.filter(s => s.category_type === 'quarterly') || [];
  const yearlyItems = summaryData?.summary.filter(s => s.category_type === 'yearly') || [];

  // Prepare chart data (top 10 categories by budget)
  const chartData = summaryData?.summary
    .filter(s => s.budget > 0)
    .sort((a, b) => b.budget - a.budget)
    .slice(0, 10)
    .map(item => ({
      name: item.category_name.length > 15 
        ? item.category_name.substring(0, 15) + '...' 
        : item.category_name,
      Budget: item.budget,
      Actual: item.actual,
    })) || [];

  if (loading) {
    return (
      <main className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value as 'month' | 'quarter' | 'year');
                setSelectedPeriodValue('');
              }}
              className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="year">Yearly</option>
              <option value="quarter">Quarterly</option>
              <option value="month">Monthly</option>
            </select>
            {selectedPeriod === 'month' && (
              <select
                value={selectedPeriodValue}
                onChange={(e) => setSelectedPeriodValue(e.target.value)}
                className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Months</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            )}
            {selectedPeriod === 'quarter' && (
              <select
                value={selectedPeriodValue}
                onChange={(e) => setSelectedPeriodValue(e.target.value)}
                className="px-4 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Quarters</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            )}
          </div>
        </div>

        {/* Totals Summary */}
        {summaryData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Budget</h3>
              <p className="text-3xl font-bold text-gray-900">
                ${summaryData.totals.budget.toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-6 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Spending</h3>
              <p className="text-3xl font-bold text-gray-900">
                ${summaryData.totals.actual.toFixed(2)}
              </p>
            </div>
            <div className={`bg-white p-6 border rounded-lg ${summaryData.totals.difference >= 0 ? 'border-green-500' : 'border-red-500'}`}>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Difference</h3>
              <p className={`text-3xl font-bold ${summaryData.totals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${summaryData.totals.difference >= 0 ? '+' : ''}{summaryData.totals.difference.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white p-6 border rounded-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">Budget vs Actual (Top 10 Categories)</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Budget" fill="#3b82f6" />
                <Bar dataKey="Actual" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Summary Tables */}
        <div className="space-y-8">
          {monthlyItems.length > 0 && (
            <div className="bg-white border-2 border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-3"></div>
                  <h2 className="text-2xl font-semibold text-gray-900">Monthly Categories</h2>
                  <span className="ml-3 px-3 py-1 text-sm font-medium rounded bg-blue-100 text-blue-800">
                    {getPeriodLabel()}
                  </span>
                </div>
                <SummaryCard items={monthlyItems} type="monthly" />
              </div>
              <SummaryTable items={monthlyItems} />
            </div>
          )}

          {quarterlyItems.length > 0 && (
            <div className="bg-white border-2 border-purple-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-3"></div>
                  <h2 className="text-2xl font-semibold text-gray-900">Quarterly Categories</h2>
                  <span className="ml-3 px-3 py-1 text-sm font-medium rounded bg-purple-100 text-purple-800">
                    {getPeriodLabel()}
                  </span>
                </div>
                <SummaryCard items={quarterlyItems} type="quarterly" />
              </div>
              <SummaryTable items={quarterlyItems} />
            </div>
          )}

          {yearlyItems.length > 0 && (
            <div className="bg-white border-2 border-orange-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500 mr-3"></div>
                  <h2 className="text-2xl font-semibold text-gray-900">Yearly Categories</h2>
                  <span className="ml-3 px-3 py-1 text-sm font-medium rounded bg-orange-100 text-orange-800">
                    {getPeriodLabel()}
                  </span>
                </div>
                <SummaryCard items={yearlyItems} type="yearly" />
              </div>
              <SummaryTable items={yearlyItems} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ items, type }: { items: SummaryItem[]; type: 'monthly' | 'quarterly' | 'yearly' }) {
  const totalBudget = items.reduce((sum, item) => sum + item.budget, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actual, 0);
  const totalDifference = totalBudget - totalActual;
  
  const colors = {
    monthly: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    quarterly: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    yearly: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  };
  
  const colorScheme = colors[type];

  return (
    <div className={`${colorScheme.bg} ${colorScheme.border} border rounded-lg p-3 min-w-[200px]`}>
      <div className="text-xs font-medium text-gray-600 mb-1">Total</div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-lg font-bold text-gray-900">${totalActual.toFixed(2)}</div>
          <div className="text-xs text-gray-500">of ${totalBudget.toFixed(2)}</div>
        </div>
        <div className={`text-sm font-semibold ${totalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {totalDifference >= 0 ? '+' : ''}${totalDifference.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function SummaryTable({ items }: { items: SummaryItem[] }) {
  // Calculate averages
  const totalBudget = items.reduce((sum, item) => sum + item.budget, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actual, 0);
  const totalDifference = items.reduce((sum, item) => sum + item.difference, 0);
  const avgBudget = items.length > 0 ? totalBudget / items.length : 0;
  const avgActual = items.length > 0 ? totalActual / items.length : 0;

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Budget
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actual
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Difference
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg/Mo
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item.category_id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {item.category_name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                ${item.budget.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                ${item.actual.toFixed(2)}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                item.difference >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {item.difference >= 0 ? '+' : ''}${item.difference.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                ${(item.actual / 12).toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-semibold">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              Total
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
              ${totalBudget.toFixed(2)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
              ${totalActual.toFixed(2)}
            </td>
            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
              totalDifference >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {totalDifference >= 0 ? '+' : ''}${totalDifference.toFixed(2)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
              ${(totalActual / 12).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
