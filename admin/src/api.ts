import type {
  AnalysisFull,
  AnalysisSummary,
  ApiToken,
  Company,
  CompanyDetail,
  CompanyListItem,
  FieldDef,
  LedgerEntry,
  Meta,
  PaymentTotals,
  Plan,
  Report,
  Settings,
  Stats,
  Subscription,
  Account,
} from './types';

const TOKEN_KEY = 'scp_admin_token';

export const auth = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {}
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = auth.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && !url.endsWith('/auth/login')) {
    auth.clear();
    window.dispatchEvent(new Event('scp-logout'));
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `HTTP ${res.status}`, data.code);
  }
  return res.json();
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>('/api/admin/auth/login', { method: 'POST', body: json({ username, password }) }),
  me: () => request<{ username: string }>('/api/admin/auth/me'),

  stats: () => request<Stats>('/api/admin/stats'),
  meta: () => request<Meta>('/api/admin/settings/meta'),

  settings: () => request<Settings>('/api/admin/settings'),
  saveSettings: (
    body: Partial<{ geminiApiKey: string; analyzeModel: string; fallbackModels: string; maxAudioMinutes: number; geminiInputPrice: number; geminiOutputPrice: number; usdRate: number }>
  ) =>
    request<Settings>('/api/admin/settings', { method: 'PUT', body: json(body) }),
  testGemini: () => request<{ ok: boolean; model?: string; reply?: string; ms?: number; error?: string }>('/api/admin/settings/test-gemini', { method: 'POST' }),

  plans: () => request<Plan[]>('/api/admin/plans'),
  createPlan: (body: Partial<Plan>) => request<Plan>('/api/admin/plans', { method: 'POST', body: json(body) }),
  updatePlan: (id: string, body: Partial<Plan>) => request<Plan>(`/api/admin/plans/${id}`, { method: 'PATCH', body: json(body) }),
  deletePlan: (id: string) => request<{ ok: boolean; deactivated?: boolean }>(`/api/admin/plans/${id}`, { method: 'DELETE' }),

  companies: () => request<CompanyListItem[]>('/api/admin/companies'),
  company: (id: string) => request<CompanyDetail>(`/api/admin/companies/${id}`),
  createCompany: (body: Partial<Company> & { planId: string; customFields?: FieldDef[] }) =>
    request<Company & { pendingSubscription: Subscription }>('/api/admin/companies', { method: 'POST', body: json(body) }),
  updateCompany: (id: string, body: Partial<Company> & { customFields?: FieldDef[] }) =>
    request<Company>(`/api/admin/companies/${id}`, { method: 'PATCH', body: json(body) }),
  deleteCompany: (id: string) => request<{ ok: boolean }>(`/api/admin/companies/${id}`, { method: 'DELETE' }),

  adminAnalyze: (companyId: string, form: FormData) =>
    request<AnalysisFull & { account: Account }>(`/api/admin/companies/${companyId}/analyze`, { method: 'POST', body: form }),

  createToken: (companyId: string, name: string) =>
    request<ApiToken & { token: string }>(`/api/admin/companies/${companyId}/tokens`, { method: 'POST', body: json({ name }) }),
  revokeToken: (companyId: string, tokenId: string) =>
    request<{ ok: boolean }>(`/api/admin/companies/${companyId}/tokens/${tokenId}`, { method: 'DELETE' }),

  subscribe: (companyId: string, planId: string, opts: { note?: string; paidAmount?: number; activate?: boolean } = {}) =>
    request<{ subscription: Subscription; account: Account }>(`/api/admin/companies/${companyId}/subscriptions`, {
      method: 'POST',
      body: json({ planId, ...opts }),
    }),
  activateSubscription: (companyId: string, subId: string, body: { amount?: number; note?: string }) =>
    request<{ subscription: Subscription; company: Company; account: Account }>(`/api/admin/companies/${companyId}/subscriptions/${subId}/activate`, {
      method: 'POST',
      body: json(body),
    }),
  cancelSubscription: (companyId: string, subId: string) =>
    request<{ subscription: Subscription; account: Account }>(`/api/admin/companies/${companyId}/subscriptions/${subId}`, {
      method: 'PATCH',
      body: json({ status: 'cancelled' }),
    }),
  topUp: (companyId: string, amount: number, note: string) =>
    request<{ entry: LedgerEntry; account: Account }>(`/api/admin/companies/${companyId}/payments`, { method: 'POST', body: json({ amount, note }) }),

  payments: (params: { companyId?: string; kind?: string; from?: string; to?: string; limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
    return request<{ items: LedgerEntry[]; totals: PaymentTotals }>(`/api/admin/payments?${p}`);
  },
  createPayment: (body: { companyId: string; kind: 'topup' | 'package'; amount: number; subscriptionId?: string; method?: string; paidAt?: string; note?: string }) =>
    request<{ payment: LedgerEntry; account: Account }>('/api/admin/payments', { method: 'POST', body: json(body) }),
  updatePayment: (id: string, body: { amount?: number; note?: string; method?: string; paidAt?: string }) =>
    request<{ payment: LedgerEntry; account: Account }>(`/api/admin/payments/${id}`, { method: 'PATCH', body: json(body) }),
  deletePayment: (id: string) => request<{ ok: boolean; subscriptionId: string | null }>(`/api/admin/payments/${id}`, { method: 'DELETE' }),

  report: (companyId: string, from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return request<Report>(`/api/admin/companies/${companyId}/report?${p}`);
  },
  companyAnalyses: (companyId: string, limit = 50, offset = 0) =>
    request<{ total: number; items: AnalysisSummary[] }>(`/api/admin/companies/${companyId}/analyses?limit=${limit}&offset=${offset}`),

  analyses: (params: { companyId?: string; status?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)));
    return request<{ total: number; items: AnalysisSummary[] }>(`/api/admin/analyses?${p}`);
  },
  analysis: (id: string) => request<AnalysisFull>(`/api/admin/analyses/${id}`),
  deleteAnalysis: (id: string) => request<{ ok: boolean }>(`/api/admin/analyses/${id}`, { method: 'DELETE' }),
};
