import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Loader2,
  ShieldCheck,
  Sparkles,
  Crown,
  KeyRound,
} from 'lucide-react';
import {
  adminLogin,
  getAdminToken,
  setAdminToken,
} from '@/lib/wallApi';
import { AdminPanel } from '@/components/admin/AdminPanel';

const easeOut = [0.22, 1, 0.36, 1] as const;

function LoginView({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const { token } = await adminLogin(password);
      setAdminToken(token);
      onAuthed();
    } catch (e) {
      const msg = String((e as Error).message);
      if (msg === 'wrong_password') setError('Incorrect password. Try again.');
      else if (msg === 'rate_limited') setError('Too many failed attempts. Wait a few minutes.');
      else setError('Could not reach the admin server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: easeOut }}
      className="w-full max-w-md relative"
    >
      {/* glow behind card */}
      <div className="absolute -inset-8 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,122,24,0.14) 0%, transparent 70%)', filter: 'blur(20px)' }} />
      {/* floating particles */}
      <div className="absolute -top-6 left-8 pointer-events-none">
        <motion.div animate={{ y: [0, -10, 0], opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
          <Sparkles className="w-5 h-5 text-[#D9A441]/50" />
        </motion.div>
      </div>
      <div className="absolute top-1/3 -right-4 pointer-events-none">
        <motion.div animate={{ y: [0, 10, 0], opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          <Crown className="w-6 h-6 text-[#FF7A18]/40" />
        </motion.div>
      </div>

      <div
        className="relative rounded-[32px] p-8 md:p-10 overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, rgba(32,22,14,0.97) 0%, rgba(16,11,8,0.96) 55%, rgba(24,14,8,0.97) 100%)',
          border: '1.5px solid transparent',
          backgroundImage:
            'linear-gradient(165deg, rgba(32,22,14,0.97), rgba(16,11,8,0.96), rgba(24,14,8,0.97)), linear-gradient(135deg, rgba(232,180,92,0.55) 0%, rgba(255,122,24,0.18) 30%, rgba(255,255,255,0.06) 50%, rgba(255,122,24,0.18) 70%, rgba(232,180,92,0.55) 100%)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0 30px 90px rgba(0,0,0,0.65), 0 0 90px rgba(255,122,24,0.1), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* top shine line */}
        <div className="absolute top-0 left-[10%] right-[10%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,180,92,0.7), transparent)' }} />
        {/* animated shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(232,180,92,0.06) 50%, transparent 60%)', backgroundSize: '250% 100%' }}
          animate={{ backgroundPosition: ['120% 0', '-120% 0'] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        />

        {/* shield */}
        <div className="relative mx-auto mb-6 w-fit">
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -inset-4 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(217,164,65,0.28) 0%, transparent 70%)', filter: 'blur(8px)' }}
          />
          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.7, ease: easeOut, delay: 0.15 }}
            className="relative w-[76px] h-[76px] rounded-[24px] flex items-center justify-center overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(232,180,92,0.18) 0%, rgba(18,12,10,0.95) 55%)',
              border: '1.5px solid rgba(217,164,65,0.55)',
              boxShadow: '0 0 34px rgba(217,164,65,0.32), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
          >
            <div className="absolute inset-0 shimmer pointer-events-none" />
            <ShieldCheck className="w-9 h-9 text-[#E8B45C] drop-shadow-[0_0_12px_rgba(217,164,65,0.6)]" />
          </motion.div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E8B45C, #b3421f)', border: '2px solid #12100c', boxShadow: '0 0 14px rgba(217,164,65,0.5)' }}>
            <Lock className="w-3 h-3 text-[#0d0906]" />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6, ease: easeOut }} className="text-center">
          <div className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[10px] font-black uppercase tracking-[0.28em] mb-3" style={{ background: 'rgba(217,164,65,0.08)', border: '1px solid rgba(217,164,65,0.28)', color: '#E8B45C' }}>
            <Sparkles className="w-3 h-3" /> Restricted area
          </div>
          <h2 className="text-[26px] font-black tracking-tight leading-none" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <span className="metal-shine">300K Edits</span>
            <span style={{ color: '#F7F3EE' }}> — Admin</span>
          </h2>
          <p className="text-[12.5px] mt-2.5 font-medium" style={{ color: 'rgba(247,243,238,0.42)' }}>
            Authorized personnel only. Every review is manual.
          </p>
        </motion.div>

        <div className="space-y-4 mt-7">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6, ease: easeOut }}
            className="group flex items-center gap-3 h-[56px] px-5 rounded-2xl transition-all duration-300 focus-within:scale-[1.01]"
            style={{ background: 'rgba(6,5,4,0.75)', border: '1px solid rgba(217,164,65,0.22)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)' }}
          >
            <KeyRound className="w-[18px] h-[18px] text-[#D9A441]/70 shrink-0 group-focus-within:text-[#E8B45C] group-focus-within:drop-shadow-[0_0_8px_rgba(217,164,65,0.7)] transition-all" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Admin password"
              autoFocus
              className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-[rgba(247,243,238,0.22)] font-medium"
              style={{ color: '#F7F3EE' }}
            />
            <div className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: password ? '#7FE08B' : 'rgba(255,255,255,0.12)', boxShadow: password ? '0 0 8px #7FE08B' : 'none' }} />
          </motion.div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key={error}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, x: [0, -7, 7, -4, 4, 0] }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.45, ease: easeOut }}
                className="flex items-center gap-2 text-[12.5px] font-bold px-4 py-2.5 rounded-xl"
                style={{ color: '#FF9A9A', background: 'rgba(255,80,80,0.07)', border: '1px solid rgba(255,80,80,0.22)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B] animate-pulse shrink-0" />
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6, ease: easeOut }}
            onClick={submit}
            disabled={busy || !password}
            whileHover={!busy && password ? { scale: 1.025, y: -1 } : {}}
            whileTap={!busy && password ? { scale: 0.97 } : {}}
            className="premium-btn relative w-full h-[56px] rounded-2xl font-black tracking-[0.12em] uppercase text-[13.5px] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            style={{
              color: '#0d0906',
              background: password ? 'linear-gradient(135deg, #F4C876 0%, #D9A441 45%, #b3421f 100%)' : 'linear-gradient(135deg, rgba(232,180,92,0.35), rgba(217,164,65,0.3))',
              fontFamily: 'Cairo, sans-serif',
              boxShadow: password ? '0 0 28px rgba(217,164,65,0.4), 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)' : 'none',
            }}
          >
            <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)', backgroundSize: '250% 100%', animation: password ? 'shimmer 2.8s infinite' : 'none' }} />
            <span className="relative flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Lock className="w-4 h-4" /> Unlock Console</>}
            </span>
          </motion.button>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(217,164,65,0.2))' }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: 'rgba(247,243,238,0.25)' }}>TMNAA Secure</span>
            <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(217,164,65,0.2), transparent)' }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AdminPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));

  return (
    <div className="min-h-screen bg-[#070605] text-white overflow-x-hidden relative">
      {/* cinematic backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(255,122,24,0.13) 0%, rgba(179,66,31,0.05) 40%, transparent 70%)' }} />
        <motion.div
          className="absolute -top-32 left-[8%] w-[480px] h-[480px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.09) 0%, transparent 65%)', filter: 'blur(40px)' }}
          animate={{ x: [0, 40, 0], y: [0, 24, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-[30%] right-[4%] w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(217,164,65,0.08) 0%, transparent 65%)', filter: 'blur(40px)' }}
          animate={{ x: [0, -36, 0], y: [0, -20, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* grid */}
        <div className="absolute inset-0 opacity-[0.5]" style={{ backgroundImage: 'linear-gradient(rgba(217,164,65,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(217,164,65,0.035) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse 75% 60% at 50% 30%, black 30%, transparent 75%)' }} />
      </div>
      <div className="absolute inset-0 pointer-events-none noise-overlay" />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 py-14">
        <AnimatePresence mode="wait">
          {authed ? (
            <motion.div key="panel" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: easeOut }} className="w-full flex justify-center">
              <AdminPanel />
            </motion.div>
          ) : (
            <motion.div key="login" exit={{ opacity: 0, y: -20, scale: 0.98 }} transition={{ duration: 0.4 }} className="w-full flex justify-center">
              <LoginView onAuthed={() => setAuthed(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative pb-10 pt-6 text-center z-10">
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="inline-flex items-center gap-2.5 text-[10.5px] font-black tracking-[0.34em] uppercase px-5 h-9 rounded-full"
          style={{ color: 'rgba(247,243,238,0.32)', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(217,164,65,0.12)' }}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#D9A441]/60" /> TMNAA — Admin Console
        </motion.p>
      </footer>
    </div>
  );
}

export default AdminPage;
