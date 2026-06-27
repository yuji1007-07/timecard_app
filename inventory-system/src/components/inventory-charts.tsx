"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const yenFmt = (v: number) => "¥" + Math.round(v).toLocaleString("ja-JP");

export function BrandValuePie({
  data,
}: {
  data: { name: string; color: string; wholesale: number }[];
}) {
  const filtered = data.filter((d) => d.wholesale > 0);
  if (filtered.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={filtered} dataKey="wholesale" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
          {filtered.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => yenFmt(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function StoreValueBar({
  data,
}: {
  data: { storeName: string; valueWholesale: number }[];
}) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => "¥" + (v / 1000).toFixed(0) + "k"} fontSize={11} />
        <YAxis type="category" dataKey="storeName" width={110} fontSize={11} />
        <Tooltip formatter={(v: number) => yenFmt(v)} />
        <Bar dataKey="valueWholesale" fill="#1e3a5f" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DiffTrendChart({
  data,
}: {
  data: { month: string; diffCount: number; diffAmount: number }[];
}) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={11} />
        <YAxis yAxisId="left" fontSize={11} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => "¥" + (v / 1000).toFixed(0) + "k"} fontSize={11} />
        <Tooltip formatter={(v: number, n) => (n === "ズレ金額" ? yenFmt(v) : v)} />
        <Line yAxisId="left" type="monotone" dataKey="diffCount" name="ズレ件数" stroke="#dc2626" strokeWidth={2} />
        <Line yAxisId="right" type="monotone" dataKey="diffAmount" name="ズレ金額" stroke="#ca8a04" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">データがありません</div>;
}
