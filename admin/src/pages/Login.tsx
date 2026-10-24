import React, { useState } from 'react';
import { Radio, LogIn } from 'lucide-react';
import { api, auth } from '../api';
import { Button, ErrorBox, Field, Input } from '../components/ui';

export default function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api.login(username.trim(), password);
      auth.set(r.token);
      onLogin(r.username);
    } catch (err: any) {
      setError(err.message || 'Kirish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 space-y-4 fade-up">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900">Sales Coaching Platform</div>
            <div className="text-xs text-slate-500">Admin panelga kirish</div>
          </div>
        </div>
        <Field label="Login">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>
        <Field label="Parol">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={loading} icon={<LogIn className="w-4 h-4" />} className="w-full">
          Kirish
        </Button>
        <p className="text-[11px] text-slate-400 text-center">Login va parol serverdagi .env faylida (ADMIN_USERNAME / ADMIN_PASSWORD)</p>
      </form>
    </div>
  );
}
