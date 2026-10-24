import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api';
import type { AnalysisSummary, CompanyListItem } from '../types';
import { Badge, Card, Empty, ErrorBox, PageHeader, RatingBadge, Select, Spinner, StatusBadge, Table, Td, fmtDate, fmtDuration, fmtMoney } from '../components/ui';

export const AnalysisTable: React.FC<{ items: AnalysisSummary[]; showCompany?: boolean; linkBase?: string }> = ({ items, showCompany, linkBase = '/analyses' }) => (
  <Table head={[...(showCompany ? ['Kompaniya'] : []), 'Vaqt', 'Nomi / fayl', 'CRM ID', 'Davomiylik', 'Hisob', 'Baho (10)', 'Ball', 'Skript', 'Holat']}>
    {items.map((a) => (
      <tr key={a.id} className="hover:bg-slate-50">
        {showCompany && (
          <Td className="text-xs">
            <Link to={`/companies/${a.companyId}`} className="hover:text-indigo-700 font-semibold">
              {a.companyName}
            </Link>
          </Td>
        )}
        <Td className="text-xs text-slate-500 whitespace-nowrap">{fmtDate(a.createdAt)}</Td>
        <Td>
          <Link to={`${linkBase}/${a.id}`} className="font-semibold text-slate-900 hover:text-indigo-700 line-clamp-1">
            {a.title || a.fileName || a.id}
          </Link>
          <div className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">{a.fileName}</div>
        </Td>
        <Td mono>{a.externalId || '—'}</Td>
        <Td className="text-xs whitespace-nowrap">{fmtDuration(a.durationSeconds)}</Td>
        <Td className="text-xs whitespace-nowrap">
          {a.status === 'done' ? (
            <>
              {a.billing.billedMinutes} daq{a.billing.type === 'per_minute' && <span className="text-slate-500"> · {fmtMoney(a.billing.cost)}</span>}
            </>
          ) : (
            '—'
          )}
        </Td>
        <Td>{a.status === 'done' ? <RatingBadge rating={a.rating} compact /> : '—'}</Td>
        <Td>
          {a.status === 'done' ? (
            <Badge tone={(a.overallScore ?? 0) >= 75 ? 'green' : (a.overallScore ?? 0) >= 50 ? 'amber' : 'red'}>
              {a.overallScore ?? '—'} · {a.overallGrade || '—'}
            </Badge>
          ) : (
            <span className="text-[11px] text-rose-700 line-clamp-1 max-w-[200px]" title={a.error || ''}>
              {a.error}
            </span>
          )}
        </Td>
        <Td>
          {a.scriptScore === null || a.scriptScore === undefined ? (
            <span className="text-slate-300">—</span>
          ) : (
            <Badge tone={a.scriptScore >= 75 ? 'green' : a.scriptScore >= 50 ? 'amber' : 'red'}>{Math.round(a.scriptScore)}%</Badge>
          )}
        </Td>
        <Td>
          <StatusBadge status={a.status} />
        </Td>
      </tr>
    ))}
  </Table>
);

export default function Analyses() {
  const [items, setItems] = useState<AnalysisSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    api.companies().then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setItems(null);
      api
        .analyses({ companyId, status, q, limit: LIMIT, offset: page * LIMIT })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [companyId, status, q, page]);

  return (
    <>
      <PageHeader title="Tahlillar" subtitle="CRM'lardan kelgan barcha qoʻngʻiroq tahlillari" />
      <ErrorBox error={error} />
      <Card padded={false}>
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Nomi, fayl yoki CRM ID"
              className="flex-1 text-sm focus:outline-none bg-transparent"
            />
          </div>
          <Select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setPage(0);
            }}
            className="!w-56"
          >
            <option value="">Barcha kompaniyalar</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="!w-36"
          >
            <option value="">Barcha holat</option>
            <option value="done">Tayyor</option>
            <option value="failed">Xato</option>
          </Select>
          <span className="text-xs text-slate-400">{total} ta</span>
        </div>
        {!items ? <Spinner /> : items.length === 0 ? <Empty text="Tahlillar topilmadi" /> : <AnalysisTable items={items} showCompany />}
        {total > LIMIT && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {page * LIMIT + 1}–{Math.min(total, (page + 1) * LIMIT)} / {total}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 cursor-pointer">
                Oldingi
              </button>
              <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded border border-slate-200 disabled:opacity-40 cursor-pointer">
                Keyingi
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
