"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export type TrendPoint = { week: string } & Record<string, number | string | null>;

const COLORS = ["#1e3a5f", "#16a34a", "#dc2626", "#2c5282", "#ca8a04"];

export function KpiTrendChart({ data, series }: { data: TrendPoint[]; series: string[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">推移データがありません。</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={56} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
