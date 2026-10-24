export type PlanType = 'per_minute' | 'package';
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'list';

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  pricePerMinute: number;
  includedMinutes: number;
  price: number;
  validityDays: number | null;
  description: string;
  isActive: boolean;
  createdAt: string;
  subscribers: number;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  options?: string[];
}

export interface Subscription {
  id: string;
  planId: string;
  planName: string;
  type: PlanType;
  pricePerMinute: number;
  includedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number | null;
  price: number;
  startedAt: string;
  expiresAt: string | null;
  status: 'pending' | 'active' | 'exhausted' | 'expired' | 'cancelled';
}

export interface Account {
  companyId: string;
  companyName: string;
  country: string;
  status: string;
  subscription: Subscription | null;
  pendingSubscription: Subscription | null;
  balance: number;
  remainingMinutes: number | null;
  thisMonth: { calls: number; minutes: number; cost: number };
  canAnalyze: boolean;
}

export interface Company {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  countryName: string;
  language: string;
  outputLanguage: string;
  outputLanguageName: string;
  status: 'pending' | 'active' | 'suspended';
  notes: string;
  customFields: FieldDef[];
  script: string;
  hasScript: boolean;
  portalEmail: string;
  portalEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortalMe {
  company: Company;
  account: Account;
  tokens: number;
  languages: Language[];
}

export interface PortalAccount {
  account: Account;
  subscriptions: Subscription[];
  totals: { calls: number; minutes: number; cost: number; avgScore: number | null; avgScriptScore: number | null; avgRating: number | null };
  monthly: { month: string; calls: number; minutes: number; cost: number; avgScore: number | null }[];
  daily: { day: string; calls: number; minutes: number; cost: number }[];
}

export interface PortalPayments {
  payments: LedgerEntry[];
  totals: PaymentTotals;
  charges: { id: string; amount: number; note: string; analysisId: string | null; createdAt: string }[];
  balance: number;
}

export interface CompanyListItem extends Company {
  account: Account;
  totals: { calls: number; minutes: number; cost: number; lastAnalysisAt: string | null };
  tokens: number;
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  token?: string;
}

export interface LedgerEntry {
  id: string;
  companyId?: string;
  companyName?: string;
  amount: number;
  paid: number;
  kind: 'topup' | 'charge' | 'adjustment' | 'package';
  note: string;
  method: string;
  paidAt: string;
  createdAt: string;
  analysisId: string | null;
  subscriptionId: string | null;
  subscriptionName: string | null;
}

export interface PaymentTotals {
  n: number;
  paid: number;
  topups: number;
  packages: number;
  adjustments: number;
}

export interface CompanyDetail extends Company {
  account: Account;
  tokens: ApiToken[];
  subscriptions: Subscription[];
  ledger: LedgerEntry[];
}

export interface AnalysisSummary {
  id: string;
  externalId: string | null;
  status: 'done' | 'failed';
  createdAt: string;
  fileName: string;
  title: string;
  overallScore: number | null;
  overallGrade: string;
  durationSeconds: number;
  billing: { billedMinutes: number; cost: number; type: string | null };
  customFields: Record<string, unknown>;
  model: string | null;
  processingMs: number;
  ai: { inputTokens: number; outputTokens: number; thoughtTokens: number; costUsd: number };
  scriptScore: number | null;
  rating: RatingSummary | null;
  error: string | null;
  companyId?: string;
  companyName?: string;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  timeSeconds: number;
  speaker: string;
  speakerName: string;
  role: string;
  text: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  engagementScore: number;
  keyMoment?: string;
  coachingFlag?: 'well' | 'missed';
}

export interface CoachingTask {
  id: string;
  title: string;
  description: string;
  why: string;
  priority: 'high' | 'medium' | 'low';
  deadline: string;
  category: string;
  successCriteria: string;
  relatedTimestamp?: string;
  status: string;
}

export interface RatingSummary {
  scale: 10;
  score: number;
  basis: 'script' | 'general';
  label: 'excellent' | 'good' | 'average' | 'weak' | 'poor';
}

export interface Rating extends RatingSummary {
  verdict: string;
  criteria: { name: string; score: number; required: boolean; comment: string }[];
}

export interface ScriptStep {
  id: string;
  step: string;
  required?: boolean;
  status: 'done' | 'partial' | 'missed';
  evidence?: string;
  timestamp?: string;
  comment: string;
}

export interface ScriptAdherence {
  score: number;
  summary: string;
  steps: ScriptStep[];
  deviations: { timestamp?: string; whatHappened: string; scriptExpected: string; impact?: string }[];
  recommendations: string[];
  script?: string;
}

export interface AnalysisResult {
  fileName: string;
  source?: 'api' | 'admin';
  language?: { country: string; language: string; code: string; outputLanguage?: string; outputCode?: string };
  customFields?: Record<string, unknown>;
  scriptAdherence?: ScriptAdherence;
  rating?: Rating;
  callSummary: {
    title: string;
    duration: string;
    durationSeconds: number;
    speakerA: { name: string; role: string; talkTimePercent: number; wordsSpoken: number };
    speakerB: { name: string; role: string; talkTimePercent: number; wordsSpoken: number };
    overallScore: number;
    talkRatio: { speakerA: number; speakerB: number };
    callOutcome: string;
    keyStrengthsSummary: string;
    primaryRiskSummary: string;
  };
  transcript: TranscriptSegment[];
  sentimentTimeline: { time: string; timeSeconds: number; speakerAEngagement: number; speakerBEngagement: number; overallEngagement: number; phase: string; event?: string }[];
  coachingCard: {
    repName: string;
    overallGrade: string;
    threeThingsDoneWell: { id: string; title: string; quote: string; timestamp: string; analysis: string; category: string; impact: string }[];
    threeMissedOpportunities: { id: string; title: string; quote: string; timestamp: string; analysis: string; category: string; recommendation: string; alternativeScript: string }[];
    summaryAdvice: string;
    nextActionItems: string[];
    tasks: CoachingTask[];
  };
}

export interface AnalysisFull extends AnalysisSummary {
  result: AnalysisResult | null;
  country?: string;
}

export interface ReportRow {
  calls: number;
  minutes: number;
  cost: number;
  avgScore: number | null;
}

export interface Report {
  from: string;
  to: string;
  totals: ReportRow & { failed: number; aiCostUsd: number; aiCostSom: number };
  daily: (ReportRow & { day: string })[];
  monthly: (ReportRow & { month: string })[];
  grades: { grade: string; n: number }[];
  account: Account;
}

export interface Stats {
  companies: { total: number; active: number; pending: number };
  lowBalance: { id: string; name: string; type: PlanType; remainingMinutes: number }[];
  allTime: { calls: number; minutes: number; cost: number };
  thisMonth: {
    calls: number;
    minutes: number;
    perMinuteRevenue: number;
    packageRevenue: number;
    packagesSold: number;
    topups: number;
    avgScore: number | null;
    avgRating: number | null;
    avgScriptScore: number | null;
    failed: number;
    aiCostUsd: number;
    aiCostSom: number;
  };
  daily: { day: string; calls: number; minutes: number; cost: number; avgRating: number | null }[];
  topCompanies: { id: string; name: string; country: string; calls: number; minutes: number; cost: number }[];
  recent: AnalysisSummary[];
}

export interface Settings {
  geminiApiKeyMasked: string;
  geminiKeySource: 'settings' | 'env' | 'none';
  analyzeModel: string;
  fallbackModels: string;
  maxAudioMinutes: number;
  geminiInputPrice: number;
  geminiOutputPrice: number;
  usdRate: number;
}

export interface Country {
  code: string;
  name: string;
  language: string;
  languageCode: string;
  note?: string;
}

export interface Language {
  code: string;
  language: string;
  name: string;
  note?: string;
}

export interface Meta {
  countries: Country[];
  languages: Language[];
  fieldTypes: FieldType[];
}
