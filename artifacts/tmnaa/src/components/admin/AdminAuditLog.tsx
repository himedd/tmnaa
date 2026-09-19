import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import type { AdminAction } from '@/lib/wallApi';
import { timeAgo } from '@/lib/wallApi';

const GOLD = '#D9A441';

const ACTION_META: Record<string, { label: string; c: string; bg: string }> = {
  approve: { label: 'approved', c: '#7FE08B', bg: 'rgba(80,200,120,0.12)' },
  reject: { label: 'rejected', c: '#FF8A8A', bg: 'rgba(255,80,80,0.12)' },
  unpublish: { label: 'took down', c: '#FF8A8A', bg: 'rgba(255,80,80,0.12)' },
  undo: { label: 'undid', c: '#D9B67A', bg: 'rgba(217,182,122,0.12)' },
  update: { label: 'edited', c: '#8AB4FF', bg: 'rgba(138,180,255,0.12)' },
  note: { label: 'noted', c: '#8AB4FF', bg: 'rgba(138,180,255,0.12)' },
  clear_reports: { label: 'cleared flags', c: '#FF9A3C', bg: 'rgba(255,140,60,0.12)' },
  report: { label: 'flagged (public)', c: '#FF9A3C', bg: 'rgba(255,140,60,0.12)' },
};

interface Props {
  actions: AdminAction[];
  itemNames: Map<string, string>;
}

export function AdminAuditLog({ actions, itemNames }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        (a.admin ?? '').toLowerCase().includes(q) ||
        (a.action ?? '').toLowerCase().includes(q) ||
        (a.reason ?? '').toLowerCase().includes(q) ||
        (a.note ?? '').toLowerCase().includes(q) ||
        (a.meta ? JSON.stringify(a.meta) : '').toLowerCase().includes(q) ||
        (itemNames.get(a.submission_id) ?? '')
          .toLowerCase()
          .includes(q),
    );
  }, [actions, query, itemNames]);

  return (
    <div className="rounded-[22px] p-6" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)' }}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ScrollText className="w-4 h-4 text-[#D9A441]" />
        <h3 className="text-[13px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
          Full audit log — every moderation action, in order
        </h3>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, action, reason…"
          className="ml-auto h-9 px-4 rounded-full text-[12px] outline-none bg-transparent focus:ring-1 focus:ring-[#D9A441]/40"
          style={{ border: '1px solid rgba(217,164,65,0.2)', color: '#F7F3EE', fontFamily: 'Tajawal, sans-serif' }}
        />
      </div>
      <div className="space-y-2">
        {filtered.map((act) => {
          const meta = ACTION_META[act.action] ?? { label: act.action, c: '#ccc', bg: 'rgba(255,255,255,0.04)' };
          const by = act.admin ? String(act.admin) : 'system';
          const byShort = by.split('@')[0] || by;
          const subName = itemNames.get(act.submission_id);
          return (
            <div
              key={act.id}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[12px]"
              style={{ background: 'rgba(9,8,7,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 w-[110px] text-center"
                style={{ background: meta.bg, color: meta.c }}
              >
                {meta.label}
              </span>
              <span className="min-w-0 flex-1 truncate" style={{ color: 'rgba(247,243,238,0.75)' }}>
                {subName ? (
                  <>@<b style={{ color: '#F7F3EE' }}>{subName}</b></>
                ) : (
                  <span className="uppercase text-[10px]" style={{ color: 'rgba(247,243,238,0.4)' }}>#{act.submission_id.slice(0, 8)}</span>
                )}
                {(act.reason || act.note) && (
                  <span className="ml-1.5" style={{ color: 'rgba(247,243,238,0.45)' }}>
                    — {act.reason ? act.reason : act.note}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[11px]" style={{ color: 'rgba(247,243,238,0.35)' }}>
                {byShort} · {timeAgo(act.created_at)}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-[12.5px] font-bold" style={{ color: 'rgba(247,243,238,0.4)' }}>
            {query ? 'No matching actions.' : 'The audit log is empty for now.'}
          </p>
        )}
      </div>
    </div>
  );
}