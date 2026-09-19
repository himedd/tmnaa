import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Loader2,
  ShieldCheck,
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
    if (!password) return;
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
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: easeOut }}
      className="w-full max-w-sm"
    >
      <div className="relative rounded-[28px] p-8"
        style={{
          background: 'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.93))',
          border: '1.5px solid transparent',
          backgroundImage:
            'linear-gradient(160deg, rgba(26,18,13,0.95), rgba(16,11,8,0.93)), linear-gradient(135deg, rgba(217,164,65,0.45), rgba(255,122,24,0.2), rgba(217,164,65,0.45))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: '0 24px 70px rgba(0,0,0,0.55), 0 0 70px rgba(255,122,24,0.08)',
        }}
      >
        <div className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center relative"
          style={{ background: 'radial-gradient(circle, rgba(255,122,24,0.25) 0%, rgba(18,12,10,0.95) 60%)', border: '2px solid rgba(217,164,65,0.6)', boxShadow: '0 0 26px rgba(217,164,65,0.3)' }}
        >
          <ShieldCheck className="w-7 h-7 text-[#D9A441]" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-center mb-1" style={{ fontFamily: 'Cairo, sans-serif', color: '#F7F3EE' }}>
          300K Edits — Admin
        </h2>
        <p className="text-[12px] text-center mb-6" style={{ color: 'rgba(247,243,238,0.4)' }}>
          Restricted area. Authorized personnel only.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3 h-[52px] px-4 rounded-2xl focus-within:ring-1 focus-within:ring-[#D9A441]/40 transition-all duration-300"
            style={{ background: 'rgba(9,8,7,0.7)', border: '1px solid rgba(217,164,65,0.2)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}
          >
            <Lock className="w-4 h-4 text-[#D9A441]/70 shrink-0" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Admin password"
              autoFocus
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[rgba(247,243,238,0.2)]"
              style={{ color: '#F7F3EE' }}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[12.5px] font-medium"
                style={{ color: '#FF8A8A' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            onClick={submit}
            disabled={busy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="relative w-full h-[54px] rounded-full font-black tracking-wider disabled:opacity-60"
            style={{
              color: '#0d0906',
              background: 'linear-gradient(135deg, #E8B45C, #D9A441, #b3421f)',
              fontFamily: 'Cairo, sans-serif',
              boxShadow: '0 0 24px rgba(217,164,65,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            {busy ? <Loader2 className="mx-auto w-5 h-5 animate-spin" /> : 'Unlock'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function AdminPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));

  return (
    <div className="min-h-screen bg-[#090807] text-white overflow-x-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,122,24,0.1) 0%, transparent 70%)' }} />
      <div className="absolute inset-0 pointer-events-none noise-overlay" />

      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16">
        {authed ? <AdminPanel /> : <LoginView onAuthed={() => setAuthed(true)} />}
      </main>

      <footer className="relative pb-14 pt-10 text-center">
        <p className="text-[11px] font-black tracking-[0.3em] uppercase" style={{ color: 'rgba(247,243,238,0.25)' }}>
          TMNAA — Admin Console
        </p>
      </footer>
    </div>
  );
}

export default AdminPage;