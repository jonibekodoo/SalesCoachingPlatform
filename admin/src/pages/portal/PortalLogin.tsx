import React, { useState } from 'react';
import { Radio, LogIn } from 'lucide-react';
import { portal, portalAuth } from '../../api';
import { Button, ErrorBox, Field, Input } from '../../components/ui';
import type { Company } from '../../types';

export default function PortalLogin({ onLogin }: { onLogin: (company: Company) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await portal.login(email.trim(), password);
      portalAuth.set(r.token);
      onLogin(r.company);
    } catch (err: any) {
      setError(err.message || 'Kirish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 space-y-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900">Sales Coaching Platform</div>
            <div className="text-xs text-slate-500">Kompaniya portali</div>
          </div>
        </div>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus required />
        </Field>
        <Field label="Parol">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={loading} icon={<LogIn className="w-4 h-4" />} className="w-full">
          Kirish
        </Button>
        <p className="text-[11px] text-slate-400 text-center">Login maʼlumotlarini platforma administratori beradi.</p>
      </form>
    </div>
  );
}
