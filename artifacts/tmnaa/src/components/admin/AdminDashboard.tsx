import { useMemo } from 'react';
import { TrendingUp, Award, Heart, History } from 'lucide-react';
import type { AdminAction, WallItem } from '@/lib/wallApi';
import { timeAgo } from '@/lib/wallApi';
import { fmtDuration as f2 } from '@/lib/moderation';

const GOLD = '#D9A441';

interface Props {
  items: WallItem[];
  actions: AdminAction[];
  who: string;
  itemNames: Map<string, string>;
}

const ACTION_LABEL: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
  unpublish: 'took down',
  undo: 'undid',
  update: 'edited',
  note: 'noted',
  clear_reports: 'cleared flags',
  report: 'flagged (public)',
};

export function AdminDashboard({ items, actions, who, itemNames }: Props) {
  const stats = useMemo(() => {
    const total = items.length;
    const approved = items.filter((i) => i.status === 'approved');
    const rejected = items.filter((i) => i.status === 'rejected');
    const decided = approved.length + rejected.length;
    const approvalRate = decided > 0 ? Math.round((approved.length / decided) * 100) : 0;

    const reviewed = items.filter((i) => i.reviewedAt && i.createdAt);
    let reviewMs = 0;
    let reviewN = 0;
    for (const it of reviewed) {
      const dt = new Date(it.reviewedAt as string).getTime() - new Date(it.createdAt).getTime();
      if (Number.isFinite(dt) && dt >= 0) {
        reviewMs += dt;
        reviewN++;
      }
    }
    const avgReview = reviewN > 0 ? reviewMs / reviewN : null;

    // 7-day submissions histogram
    const days: { label: string; count: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const start = d.getTime();
      const end = start + 86_400_000;
      const count = items.filter((it) => {
        const t = new Date(it.createdAt).getTime();
        return t >= start && t < end;
      }).length;
      days.push({
        label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
        count,
      });
    }
    const maxDay = Math.max(1, ...days.map((d) => d.count));

    // top contributors (most approved)
    const byApproved = new Map<string, number>();
    for (const it of approved) {
      const key = it.name.trim() || 'Anonymous';
      byApproved.set(key, (byApproved.get(key) ?? 0) + 1);
    }
    const topContributors = [...byApproved.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topLiked = [...approved].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 5);

    return { total, approved: approved.length, rejected: rejected.length, approvalRate, avgReview, days, maxDay, topContributors, topLiked };
  }, [items]);

  const recent = useMemo(() => actions.slice(0, 20), [actions]);

  return (
    <div className="space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(
          [
            ['Total submissions', stats.total, 'rgba(217,164,65,0.12)', GOLD],
            ['Approval rate', `${stats.approvalRate}%`, 'rgba(80,200,120,0.1)', '#7FE08B'],
            ['Avg time to review', stats.avgReview ? f2(stats.avgReview) : '—', 'rgba(138,180,255,0.1)', '#8AB4FF'],
            ['Flagged', `${items.filter((i) => (i.flagCount ?? 0) > 0).length || 0}`, 'rgba(255,140,60,0.1)', '#FF9A3C'],
          ] as const
        ).map(([label, value, bg, c]) => (
          <div
            key={label}
            className="rounded-[20px] p-5"
            style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: c }}>{label}</p>
            <p className="mt-1 text-3xl font-black" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* 7-day chart */}
      <div className="rounded-[22px] p-6" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)' }}>
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-[#D9A441]" />
          <h3 className="text-[13px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
            Submissions — last 7 days
          </h3>
        </div>
        <div className="flex items-end justify-between gap-3" style={{ height: 140 }}>
          {stats.days.map((d) => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: 'rgba(247,243,238,0.45)' }}>{d.count}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-500"
                style={{
                  height: Math.max(4, Math.round((d.count / stats.maxDay) * 100)),
                  background: d.count > 0 ? 'linear-gradient(180deg, #E8B45C, #b3421f)' : 'rgba(255,255,255,0.05)',
                  boxShadow: d.count > 0 ? '0 0 14px rgba(217,164,65,0.25)' : 'none',
                }}
              />
              <span className="text-[9.5px] uppercase tracking-wider" style={{ color: 'rgba(247,243,238,0.3)' }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* top contributors */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-[#D9A441]" />
            <h3 className="text-[13px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Top contributors (most approved)
            </h3>
          </div>
          <div className="space-y-2.5">
            {stats.topContributors.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black"
                  style={{ background: i === 0 ? 'linear-gradient(135deg, #E8B45C, #b3421f)' : 'rgba(217,164,65,0.1)', color: i === 0 ? '#0d0906' : GOLD }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-[13px] font-bold truncate" style={{ color: '#F7F3EE' }}>@{name}</span>
                <span className="text-[12px] font-black" style={{ color: '#7FE08B' }}>{count}</span>
              </div>
            ))}
            {stats.topContributors.length === 0 && (
              <p className="text-[12px]" style={{ color: 'rgba(247,243,238,0.4)' }}>No approved edits yet.</p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-6 mb-3">
            <Heart className="w-4 h-4 text-[#D9A441]" />
            <h3 className="text-[13px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Most liked on the wall
            </h3>
          </div>
          <div className="space-y-2.5">
            {stats.topLiked.map((it) => (
              <div key={it.id} className="flex items-center gap-3">
                <span className="text-[12.5px] font-bold truncate flex-1" style={{ color: '#F7F3EE' }}>
                  @{it.name}
                  <span className="text-[10px] font-normal ml-2" style={{ color: 'rgba(247,243,238,0.35)' }}>{it.mediaType}</span>
                </span>
                <span className="text-[12px] font-black" style={{ color: '#7FE08B' }}>{it.likes} ♥</span>
              </div>
            ))}
            {stats.topLiked.length === 0 && (
              <p className="text-[12px]" style={{ color: 'rgba(247,243,238,0.4)' }}>No likes yet.</p>
            )}
          </div>
        </div>

        {/* recent actions */}
        <div className="rounded-[22px] p-6" style={{ background: 'rgba(9,8,7,0.6)', border: '1px solid rgba(217,164,65,0.12)' }}>
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4 text-[#D9A441]" />
            <h3 className="text-[13px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Recent actions
            </h3>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {recent.map((act) => {
              const by = act.admin ? String(act.admin) : '';
              const subName = itemNames.get(act.submission_id);
              return (
                <div key={act.id} className="flex items-start gap-3 text-[12px]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 8 }}
                >
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0"
                    style={{
                      background: act.action === 'approve' ? 'rgba(80,200,120,0.12)' : act.action === 'reject' || act.action === 'unpublish' ? 'rgba(255,80,80,0.12)' : 'rgba(217,164,65,0.1)',
                      color: act.action === 'approve' ? '#7FE08B' : act.action === 'reject' || act.action === 'unpublish' ? '#FF8A8A' : GOLD,
                    }}
                  >
                    {ACTION_LABEL[act.action] ?? act.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: 'rgba(247,243,238,0.75)' }}>
                    {subName ? <>@<b style={{ color: '#F7F3EE' }}>{subName}</b></> : (
                      <span className="uppercase text-[10px]" style={{ color: 'rgba(247,243,238,0.4)' }}>#{act.submission_id.slice(0, 8)}</span>
                    )}
                    {act.reason && <span className="ml-1" style={{ color: 'rgba(247,243,238,0.45)' }}>— {act.reason}</span>}
                    {act.note && !act.reason && <span className="ml-1" style={{ color: 'rgba(247,243,238,0.45)' }}>— {act.note}</span>}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: 'rgba(247,243,238,0.3)' }}>
                    {by ? `${by.split('@')[0]} · ` : ''}{timeAgo(act.created_at)}
                  </span>
                </div>
              );
            })}
            {recent.length === 0 && (
              <p className="text-[12px]" style={{ color: 'rgba(247,243,238,0.4)' }}>
                No moderation actions yet. Signing in as {who || 'admin'}.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}