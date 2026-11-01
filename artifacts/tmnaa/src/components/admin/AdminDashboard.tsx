import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Heart, History, Layers, Gauge, Timer, Flag, Crown, Sparkles } from 'lucide-react';
import type { AdminAction, WallItem } from '@/lib/wallApi';
import { timeAgo } from '@/lib/wallApi';
import { fmtDuration as f2 } from '@/lib/moderation';

const GOLD = '#D9A441';
const easeOut = [0.22, 1, 0.36, 1] as const;

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

  const cards = [
    { label: 'Total submissions', value: String(stats.total), c: GOLD, bg: 'rgba(217,164,65,0.12)', icon: Layers },
    { label: 'Approval rate', value: `${stats.approvalRate}%`, c: '#7FE08B', bg: 'rgba(80,200,120,0.1)', icon: Gauge },
    { label: 'Avg time to review', value: stats.avgReview ? f2(stats.avgReview) : '—', c: '#8AB4FF', bg: 'rgba(138,180,255,0.1)', icon: Timer },
    { label: 'Flagged', value: String(items.filter((i) => (i.flagCount ?? 0) > 0).length || 0), c: '#FF9A3C', bg: 'rgba(255,140,60,0.1)', icon: Flag },
  ] as const;

  return (
    <div className="space-y-5">
      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map((k, idx) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: easeOut, delay: idx * 0.07 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="rounded-[22px] p-5 relative overflow-hidden group"
            style={{ background: 'linear-gradient(160deg, rgba(26,18,12,0.92), rgba(12,9,6,0.94))', border: '1px solid rgba(217,164,65,0.14)', boxShadow: '0 12px 34px rgba(0,0,0,0.4)' }}
          >
            <div className="absolute -top-10 -right-8 w-28 h-28 rounded-full opacity-60 pointer-events-none group-hover:scale-125 transition-transform duration-700" style={{ background: `radial-gradient(circle, ${k.bg} 0%, transparent 70%)`, filter: 'blur(10px)' }} />
            <div className="flex items-center justify-between relative">
              <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: k.c }}>{k.label}</p>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.bg, border: `1px solid ${k.c}35` }}>
                <k.icon className="w-4 h-4" style={{ color: k.c }} />
              </span>
            </div>
            <motion.p key={k.value} initial={{ scale: 1.2, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className="mt-1.5 text-[30px] leading-none font-black tabular-nums relative" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              {k.value}
            </motion.p>
          </motion.div>
        ))}
      </div>

      {/* 7-day chart */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }} className="rounded-[24px] p-6 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(26,18,12,0.9), rgba(12,9,6,0.92))', border: '1px solid rgba(217,164,65,0.14)', boxShadow: '0 12px 34px rgba(0,0,0,0.4)' }}>
        <div className="absolute top-0 left-[15%] right-[15%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,164,65,0.4), transparent)' }} />
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.3)' }}>
            <TrendingUp className="w-[18px] h-[18px] text-[#E8B45C]" />
          </span>
          <div>
            <h3 className="text-[13.5px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Submissions — last 7 days
            </h3>
            <p className="text-[11px] font-medium" style={{ color: 'rgba(247,243,238,0.4)' }}>Daily intake volume</p>
          </div>
          <span className="ml-auto px-3 h-8 rounded-full text-[11px] font-black tabular-nums inline-flex items-center gap-1.5" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.25)', color: '#E8B45C' }}>
            <Sparkles className="w-3.5 h-3.5" /> {stats.total} total
          </span>
        </div>
        <div className="flex items-end justify-between gap-2.5 md:gap-3" style={{ height: 150 }}>
          {stats.days.map((d, i) => {
            const h = Math.max(6, Math.round((d.count / stats.maxDay) * 104));
            const hot = d.count >= stats.maxDay && d.count > 0;
            return (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-2 group/bar">
                <span className="text-[10.5px] font-black tabular-nums px-2 py-0.5 rounded-md transition-colors group-hover/bar:text-[#E8B45C]" style={{ color: d.count > 0 ? 'rgba(247,243,238,0.7)' : 'rgba(247,243,238,0.25)', background: hot ? 'rgba(217,164,65,0.12)' : 'transparent', border: hot ? '1px solid rgba(217,164,65,0.3)' : '1px solid transparent' }}>{d.count}</span>
                <div className="w-full flex items-end justify-center" style={{ height: 104 }}>
                  <motion.div
                    initial={{ height: 4, opacity: 0 }}
                    animate={{ height: h, opacity: 1 }}
                    transition={{ duration: 0.8, ease: easeOut, delay: 0.25 + i * 0.07 }}
                    whileHover={{ scaleY: 1.04 }}
                    className="w-full max-w-[52px] rounded-t-[10px] relative overflow-hidden"
                    style={{
                      background: d.count > 0 ? 'linear-gradient(180deg, #F4C876 0%, #D9A441 55%, #7a3a1a 100%)' : 'rgba(255,255,255,0.05)',
                      boxShadow: d.count > 0 ? '0 0 18px rgba(217,164,65,0.3), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
                    }}
                  >
                    <div className="absolute inset-0 shimmer opacity-50" />
                  </motion.div>
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: hot ? '#E8B45C' : 'rgba(247,243,238,0.32)' }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* top contributors */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.2 }} className="rounded-[24px] p-6 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(26,18,12,0.9), rgba(12,9,6,0.92))', border: '1px solid rgba(217,164,65,0.14)' }}>
          <div className="flex items-center gap-2.5 mb-5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(217,164,65,0.1)', border: '1px solid rgba(217,164,65,0.3)' }}>
              <Award className="w-[18px] h-[18px] text-[#E8B45C]" />
            </span>
            <h3 className="text-[13.5px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Top contributors
            </h3>
            <span className="ml-auto text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(247,243,238,0.3)' }}>most approved</span>
          </div>
          <div className="space-y-2">
            {stats.topContributors.map(([name, count], i) => (
              <motion.div key={name} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }} whileHover={{ x: 4, scale: 1.01 }} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.03] transition-colors" style={{ border: '1px solid transparent' }}>
                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-black shrink-0" style={i === 0 ? { background: 'linear-gradient(135deg, #F4C876, #b3421f)', color: '#0d0906', boxShadow: '0 0 16px rgba(217,164,65,0.4)' } : { background: 'rgba(217,164,65,0.08)', color: GOLD, border: '1px solid rgba(217,164,65,0.25)' }}>
                  {i === 0 ? <Crown className="w-4 h-4" /> : i + 1}
                </span>
                <span className="flex-1 text-[13.5px] font-black truncate" style={{ color: '#F7F3EE' }}>@{name}</span>
                <span className="text-[12px] font-black tabular-nums px-2.5 h-6 rounded-full inline-flex items-center" style={{ color: '#7FE08B', background: 'rgba(80,200,120,0.08)', border: '1px solid rgba(80,200,120,0.25)' }}>{count}</span>
              </motion.div>
            ))}
            {stats.topContributors.length === 0 && (
              <p className="text-[12px] py-4 text-center font-medium" style={{ color: 'rgba(247,243,238,0.4)' }}>No approved edits yet.</p>
            )}
          </div>

          <div className="flex items-center gap-2.5 mt-7 mb-4">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,80,120,0.08)', border: '1px solid rgba(255,80,120,0.25)' }}>
              <Heart className="w-[18px] h-[18px] text-[#FF8AA0]" />
            </span>
            <h3 className="text-[13.5px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Most liked on the wall
            </h3>
          </div>
          <div className="space-y-2">
            {stats.topLiked.map((it, i) => (
              <motion.div key={it.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.06 }} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.03] transition-colors">
                <span className="text-[12.5px] font-black truncate flex-1" style={{ color: '#F7F3EE' }}>
                  @{it.name}
                  <span className="text-[10px] font-bold ml-2 px-2 py-0.5 rounded-md uppercase tracking-wider" style={{ color: 'rgba(247,243,238,0.4)', background: 'rgba(255,255,255,0.04)' }}>{it.mediaType}</span>
                </span>
                <span className="text-[12px] font-black tabular-nums" style={{ color: '#FF8AA0' }}>{it.likes} ♥</span>
              </motion.div>
            ))}
            {stats.topLiked.length === 0 && (
              <p className="text-[12px] py-2 text-center font-medium" style={{ color: 'rgba(247,243,238,0.4)' }}>No likes yet.</p>
            )}
          </div>
        </motion.div>

        {/* recent actions */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut, delay: 0.25 }} className="rounded-[24px] p-6 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(26,18,12,0.9), rgba(12,9,6,0.92))', border: '1px solid rgba(217,164,65,0.14)' }}>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(138,180,255,0.08)', border: '1px solid rgba(138,180,255,0.25)' }}>
              <History className="w-[18px] h-[18px] text-[#8AB4FF]" />
            </span>
            <h3 className="text-[13.5px] font-black tracking-wide" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
              Recent actions
            </h3>
            <span className="ml-auto w-2 h-2 rounded-full bg-[#7FE08B] animate-pulse" style={{ boxShadow: '0 0 10px #7FE08B' }} />
          </div>
          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1 premium-scroll" style={{ ['--scr-from' as string]: 'rgba(217,164,65,0.4)', ['--scr-to' as string]: 'rgba(217,164,65,0.1)' } as React.CSSProperties}>
            {recent.map((act, i) => {
              const by = act.admin ? String(act.admin) : '';
              const subName = itemNames.get(act.submission_id);
              const good = act.action === 'approve';
              const bad = act.action === 'reject' || act.action === 'unpublish';
              return (
                <motion.div key={act.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + Math.min(i, 10) * 0.04 }} className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl hover:bg-white/[0.03] transition-colors" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="px-2.5 py-1 rounded-full text-[9.5px] font-black uppercase tracking-[0.12em] shrink-0 mt-0.5" style={{ background: good ? 'rgba(80,200,120,0.12)' : bad ? 'rgba(255,80,80,0.12)' : 'rgba(217,164,65,0.1)', color: good ? '#7FE08B' : bad ? '#FF8A8A' : GOLD, border: `1px solid ${good ? 'rgba(80,200,120,0.3)' : bad ? 'rgba(255,80,80,0.3)' : 'rgba(217,164,65,0.3)'}` }}>
                    {ACTION_LABEL[act.action] ?? act.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium mt-0.5" style={{ color: 'rgba(247,243,238,0.75)' }}>
                    {subName ? <>@<b style={{ color: '#F7F3EE' }}>{subName}</b></> : (
                      <span className="uppercase text-[10px] font-mono" style={{ color: 'rgba(247,243,238,0.4)' }}>#{act.submission_id.slice(0, 8)}</span>
                    )}
                    {act.reason && <span className="ml-1.5" style={{ color: 'rgba(247,243,238,0.45)' }}>— {act.reason}</span>}
                    {act.note && !act.reason && <span className="ml-1.5" style={{ color: 'rgba(247,243,238,0.45)' }}>— {act.note}</span>}
                  </span>
                  <span className="shrink-0 text-[10.5px] font-medium tabular-nums mt-1" style={{ color: 'rgba(247,243,238,0.32)' }}>
                    {by ? `${by.split('@')[0]} · ` : ''}{timeAgo(act.created_at)}
                  </span>
                </motion.div>
              );
            })}
            {recent.length === 0 && (
              <p className="text-[12px] py-6 text-center font-medium" style={{ color: 'rgba(247,243,238,0.4)' }}>
                No moderation actions yet. Signing in as {who || 'admin'}.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
