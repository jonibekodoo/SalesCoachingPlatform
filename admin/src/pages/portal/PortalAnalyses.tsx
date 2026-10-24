import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UploadCloud } from 'lucide-react';
import { portal } from '../../api';
import type { AnalysisSummary } from '../../types';
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui';
import { AnalysisTable } from '../Analyses';

export default function PortalAnalyses() {
  const [items, setItems] = useState<AnalysisSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    const t = setTimeout(() => {
      setItems(null);
      portal
        .analyses({ q, limit: LIMIT, offset: page * LIMIT })
        .then((r) => {
          setItems(r.items);
          setTotal(r.total);
        })
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [q, page]);

  return (
    <>
      <PageHeader
        title="Tahlillar"
        subtitle="Barcha yuklangan qoʻngʻiroqlar: API orqali, portaldan yoki administrator tomonidan"
        actions={
          <Link to="/portal/analyze">
            <Button icon={<UploadCloud className="w-4 h-4" />}>Audio yuklash</Button>
          </Link>
        }
      />
      <ErrorBox error={error} />
      <Card padded={false}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Nomi, fayl yoki CRM ID boʻyicha qidirish"
            className="flex-1 text-sm focus:outline-none bg-transparent"
          />
          <span className="text-xs text-slate-400">{total} ta</span>
        </div>
        {!items ? <Spinner /> : items.length === 0 ? <Empty text="Tahlillar topilmadi" /> : <AnalysisTable items={items} linkBase="/portal/analyses" />}
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
