import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

interface TimeSeriesPoint {
    label: string;
    value: number;
}

interface HeadcountPoint {
    name: string;
    value: number;
}

export const PayrollTrendsChart = ({ data }: { data: TimeSeriesPoint[] }) => {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: 'none', 
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                    itemStyle={{ color: '#60a5fa' }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Total Gross']}
                />
                <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const HeadcountDistributionChart = ({ data }: { data: HeadcountPoint[] }) => {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: '#111827', 
                        border: 'none', 
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}
                />
                <Legend 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
};
