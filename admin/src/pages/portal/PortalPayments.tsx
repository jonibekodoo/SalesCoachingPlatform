import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Package } from 'lucide-react';
import { portal } from '../../api';
import type { PortalAccount, PortalPayments as PortalPaymentsData } from '../../types';
import { Badge, Card, Empty, ErrorBox, PageHeader, Spinner, Stat, StatusBadge, Table, Td, cx, fmtDate, fmtMinutes, fmtMoney, fmtNum } from '../../components/ui';

const KIND_LABEL: Record<string, string> = { topup: 'Balans toʻldirish', package: 'Paket toʻlovi', adjustment: 'Tuzatish' };

export default function PortalPayments() {
  const [data, setData] = useState<PortalPaymentsData | null>(null);
  const [acc, setAcc] = useState<PortalAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portal.payments().then(setData).catch((e) => setError(e.message));
    portal.account().then(setAcc).catch(() => {});
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!data || !acc) return <Spinner />;
  const a = acc.account;
  const sub = a.subscription;

  return (
    <>
      <PageHeader title="Hisob va toʻlovlar" subtitle="Tarif, qoldiq, toʻlovlar tarixi va har tahlil uchun yechilgan summalar" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Joriy tarif" value={sub ? sub.planName : 'Yoʻq'} hint={sub ? (sub.type === 'package' ? 'Paket' : `${fmtMoney(sub.pricePerMinute)} / daqiqa`) : ''} tone="dark" icon={sub?.type === 'package' ? <Package className="w-4 h-4" /> : <Wallet className="w-4 h-4" />} />
        <Stat label="Qoldiq daqiqa" value={fmtMinutes(a.remainingMinutes)} hint={sub?.type === 'package' ? `${fmtNum(sub.usedMinutes)} / ${fmtNum(sub.includedMinutes)} ishlatilgan` : undefined} />
        <Stat label="Balans" value={fmtMoney(a.balance)} hint={sub?.type === 'per_minute' ? 'daqiqalik tarif uchun' : 'paketda ishlatilmaydi'} />
        <Stat label="Jami toʻlangan" value={fmtMoney(data.totals.paid)} hint={`${data.totals.n} ta toʻlov`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Obunalar / paketlar" padded={false}>
          {acc.subscriptions.length === 0 ? (
            <Empty text="Tarif biriktirilmagan" />
          ) : (
            <Table head={['Tarif', 'Ishlatilgan', 'Boshlangan', 'Muddat', 'Holat']}>
              {acc.subscriptions.map((s) => (
                <tr key={s.id} className={s.status !== 'active' ? 'opacity-60' : ''}>
                  <Td>
                    <div className="font-semibold">{s.planName}</div>
                    <Badge tone={s.type === 'package' ? 'violet' : 'sky'}>{s.type === 'package' ? 'Paket' : 'Daqiqalik'}</Badge>
                  </Td>
                  <Td className="text-xs">
                    {s.type === 'package' ? (
                      <div>
                        {fmtNum(s.usedMinutes)} / {fmtNum(s.includedMinutes)} daq
                        <div className="h-1.5 w-24 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (s.usedMinutes / Math.max(1, s.includedMinutes)) * 100)}%` }} />
                        </div>
                      </div>
                    ) : (
                      `${fmtNum(s.usedMinutes)} daq`
                    )}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{fmtDate(s.startedAt, false)}</Td>
                  <Td className="text-xs whitespace-nowrap">{s.expiresAt ? fmtDate(s.expiresAt, false) : '—'}</Td>
                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Toʻlovlar" padded={false}>
          {data.payments.length === 0 ? (
            <Empty text="Toʻlovlar yoʻq" />
          ) : (
            <Table head={['Sana', 'Turi', 'Summa', 'Izoh']}>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <Td className="text-xs whitespace-nowrap">{fmtDate(p.paidAt, false)}</Td>
                  <Td>
                    <Badge tone={p.kind === 'topup' ? 'green' : p.kind === 'package' ? 'violet' : 'amber'}>{KIND_LABEL[p.kind] || p.kind}</Badge>
                    {p.subscriptionName && <div className="text-[11px] text-slate-500">{p.subscriptionName}</div>}
                  </Td>
                  <Td className="font-mono text-xs font-bold whitespace-nowrap">{fmtMoney(p.kind === 'adjustment' ? p.amount : p.paid)}</Td>
                  <Td className="text-xs text-slate-600">{p.note || '—'}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      {data.charges.length > 0 && (
        <Card title="Tahlillar uchun yechimlar (daqiqalik tarif)" padded={false} className="mt-6">
          <Table head={['Vaqt', 'Izoh', 'Tahlil', 'Summa']}>
            {data.charges.map((c) => (
              <tr key={c.id}>
                <Td className="text-xs whitespace-nowrap">{fmtDate(c.createdAt)}</Td>
                <Td className="text-xs">{c.note}</Td>
                <Td>
                  {c.analysisId && (
                    <Link to={`/portal/analyses/${c.analysisId}`} className="text-indigo-600 hover:underline font-mono text-[11px]">
                      {c.analysisId}
                    </Link>
                  )}
                </Td>
                <Td className={cx('font-mono text-xs whitespace-nowrap', 'text-rose-700')}>{fmtMoney(c.amount)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
