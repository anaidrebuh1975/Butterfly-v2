import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart, Line, LabelList, ReferenceArea
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ThyroidEntry, MedicationMark } from '../types';
import { format as formatDateFns } from 'date-fns';

interface ChartProps {
  data: ThyroidEntry[];
  globalRefs?: any;
  medicationMarks?: MedicationMark[];
}

const ChartItem = ({ data, dataKey, name, color, unit, refRange, medicationMarks = [] }: { 
  data: any[], 
  dataKey: string, 
  name: string, 
  color: string, 
  unit: string,
  refRange: { min: number, max: number },
  medicationMarks?: MedicationMark[],
  key?: string
}) => {
  const ReferenceAreaAny = ReferenceArea as any;
  // Calculate dynamic domain
  const values = data.map(d => d[dataKey]).filter(v => v !== undefined && v !== null);
  const dataMin = values.length > 0 ? Math.min(...values) : refRange.min;
  const dataMax = values.length > 0 ? Math.max(...values) : refRange.max;
  
  const min = Math.min(dataMin, refRange.min);
  const max = Math.max(dataMax, refRange.max);
  const range = max - min;
  const padding = range === 0 ? 1 : range * 0.2;
  
  const domain: [number, number] = [Math.max(0, min - padding), max + padding];

  return (
    <div className="bg-white p-3 rounded-2xl border border-natural-100 shadow-sm">
      <div className="flex justify-between items-center mb-2 px-1">
        <h4 className="text-[8px] font-black uppercase tracking-widest text-natural-900 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></span>
          {name} <span className="text-natural-300 lowercase font-normal italic text-[8px]">({unit})</span>
        </h4>
      </div>
      <div style={{ width: "100%", height: 250 }}>
  <ResponsiveContainer width="99%" height={250}>
          <ComposedChart data={data} margin={{ top: 15, right: 10, left: -25, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ECF0ED" />
            <XAxis 
              dataKey="formattedDate" 
              interval={0}
              tick={{ fontSize: 10, fontWeight: 800, fill: '#000000', fontFamily: 'Arial Narrow, sans-serif' }}
              tickLine={false}
              axisLine={false}
              angle={-90}
              textAnchor="end"
              dy={10}
            />
            <YAxis 
              domain={domain} 
              hide 
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                fontSize: '10px',
                fontWeight: 'bold'
              }}
            />
            {refRange.max > refRange.min && (
              <ReferenceAreaAny 
                y1={refRange.min} 
                y2={refRange.max} 
                fill="#4BFFA5" 
                fillOpacity={0.25}
                isFront={false}
              />
            )}
            {refRange.max > refRange.min && <ReferenceLine y={refRange.min} stroke="#22C55E" strokeDasharray="3 3" strokeOpacity={0.3} />}
            {refRange.max > refRange.min && <ReferenceLine y={refRange.max} stroke="#22C55E" strokeDasharray="3 3" strokeOpacity={0.3} />}
            
            {/* Medication Marks */}
            {data.length > 0 && medicationMarks.map((mark, idx) => {
              const markFrom = new Date(mark.from).getTime();
              const markTo = new Date(mark.to).getTime();
              
              if (isNaN(markFrom) || isNaN(markTo)) return null;

              // Find first and last data points in range, or closest boundary points
              const chartStart = new Date(data[0].date).getTime();
              const chartEnd = new Date(data[data.length - 1].date).getTime();

              // If the mark is completely outside the chart's data range, skip
              if (markTo < chartStart || markFrom > chartEnd) return null;

              // Find the best indices for visualization on categorical axis
              let startIndex = 0;
              let endIndex = data.length - 1;

              // Constrain indices to actual overlap
              for (let i = 0; i < data.length; i++) {
                const dDate = new Date(data[i].date).getTime();
                if (dDate >= markFrom) {
                  startIndex = i;
                  break;
                }
              }
              for (let i = data.length - 1; i >= 0; i--) {
                const dDate = new Date(data[i].date).getTime();
                if (dDate <= markTo) {
                  endIndex = i;
                  break;
                }
              }

              // Safety check: if markers flip indices due to gaps, ensure order
              if (startIndex > endIndex) {
                // If it's between points, we'll just show it spanning those two points to keep it visible
                if (startIndex > 0) {
                  endIndex = startIndex;
                  startIndex = startIndex - 1;
                } else {
                  endIndex = 0;
                  startIndex = 0;
                }
              }

              const labelText = `${mark.label}${mark.notes ? ` (${mark.notes})` : ''} - [${mark.from.split('-').reverse().join('.')} - ${mark.to.split('-').reverse().join('.')}]`;
              
              return (
                <ReferenceAreaAny 
                  key={`mark-${idx}`}
                  x1={data[startIndex].formattedDate}
                  x2={data[endIndex].formattedDate}
                  fill={mark.color || "#fde68a"}
                  fillOpacity={0.4}
                  label={{ 
                    value: labelText, 
                    position: 'top', 
                    fontSize: 8, 
                    fontWeight: 900,
                    fill: '#000',
                    offset: 8,
                    className: 'uppercase tracking-tighter medication-print-label'
                  }}
                />
              );
            })}
            
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              stroke="none" 
              fill={color} 
              fillOpacity={0.05} 
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2} 
              dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }}
              connectNulls
              isAnimationActive={false}
            >
              <LabelList 
                dataKey={dataKey} 
                position="top" 
                offset={12}
                style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  fill: '#000000', 
                  fontFamily: 'Arial Narrow, sans-serif',
                }}
                formatter={(val: any) => val !== undefined && val !== null ? val.toLocaleString('de-DE') : ''}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default function ThyroidChart({ data, globalRefs, medicationMarks = [] }: ChartProps) {
  const chartData: any[] = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(entry => ({
    ...entry,
    formattedDate: format(new Date(entry.date), 'dd.MM.yy', { locale: de })
  }));

  interface ChartDef {
    dataKey: string;
    name: string;
    color: string;
    unit: string;
    refRange: { min: number, max: number };
  }

  const charts: ChartDef[] = [
    { 
      dataKey: 'tsh', 
      name: 'TSH', 
      color: '#0F172A', 
      unit: 'mU/l', 
      refRange: { 
        min: globalRefs?.tsh?.[0] ?? 0.27, 
        max: globalRefs?.tsh?.[1] ?? 4.2 
      }
    },
    { 
      dataKey: 't4', 
      name: 'fT4', 
      color: '#475569', 
      unit: 'ng/l', 
      refRange: { 
        min: globalRefs?.t4?.[0] ?? 9.3, 
        max: globalRefs?.t4?.[1] ?? 17 
      }
    },
    { 
      dataKey: 't3', 
      name: 'fT3', 
      color: '#64748B', 
      unit: 'pg/ml', 
      refRange: { 
        min: globalRefs?.t3?.[0] ?? 2.0, 
        max: globalRefs?.t3?.[1] ?? 4.4 
      }
    },
    { 
      dataKey: 'thyroxin', 
      name: 'Dosierung', 
      color: '#8B5CF6', 
      unit: 'µg LT', 
      refRange: { min: 0, max: 0 }
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
      {charts.map(chart => (
        <ChartItem 
          key={chart.dataKey}
          data={chartData}
          dataKey={chart.dataKey}
          name={chart.name}
          color={chart.color}
          unit={chart.unit}
          refRange={chart.refRange}
          medicationMarks={medicationMarks}
        />
      ))}
    </div>
  );
}
