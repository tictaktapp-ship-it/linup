import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface PageviewEntry { date: string; views: number; }
interface TopPage { path: string; views: number; uniqueVisitors: number; avgTime: number; }
interface EventEntry { event: string; timestamp: string; }
interface AnalyticsData {
  pageviewsToday: number; uniqueVisitors: number; topPage: string; conversionRate: number;
  pageviewsChart: PageviewEntry[]; topPagesTable: TopPage[]; eventsFeed: EventEntry[];
}

export default function AnalyticsDashboardScreen({ projectId }: { projectId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<AnalyticsData>('get_posthog_stats', { projectId })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { if (String(e).includes('No PostHog key')) setNoKey(true); setLoading(false); });
  }, [projectId]);

  if (loading) return <div style={{ padding: 32, color: 'var(--color-text-secondary)' }}>Loading analytics...</div>;
  if (noKey) return (
    <div style={{ padding: 32 }}>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>No PostHog key configured.</p>
      <a href={'/project/' + projectId + '/secrets'} style={{ color: 'var(--color-accent-primary)' }}>Configure secrets</a>
    </div>
  );
  if (!data) return null;

  const chartData = data.pageviewsChart.map(e => ({ name: e.date, views: e.views }));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[
          { label: 'Pageviews today', value: data.pageviewsToday.toLocaleString() },
          { label: 'Unique visitors', value: data.uniqueVisitors.toLocaleString() },
          { label: 'Top page', value: data.topPage },
          { label: 'Conversion rate', value: data.conversionRate + '%' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: '16px 20px', border: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Pageviews — last 7 days</div>
        <LineChart width={600} height={220} data={chartData}>
          <CartesianGrid strokeDasharray='3 3' stroke='var(--color-border-tertiary)' />
          <XAxis dataKey='name' tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type='monotone' dataKey='views' stroke='var(--color-accent-primary)' strokeWidth={2} dot={false} />
        </LineChart>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Top pages</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            {['Path','Views','Unique visitors','Avg time'].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: 'var(--color-text-tertiary)', fontWeight: 500, fontSize: 11 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.topPagesTable.map(r => (
            <tr key={r.path} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{r.path}</td>
              <td style={{ padding: '8px 12px' }}>{r.views}</td>
              <td style={{ padding: '8px 12px' }}>{r.uniqueVisitors}</td>
              <td style={{ padding: '8px 12px' }}>{r.avgTime}s</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Recent events</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.eventsFeed.map((ev, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: 6, fontSize: 13 }}>
              <span>{ev.event}</span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{new Date(ev.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
