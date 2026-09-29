'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

const CITIES = ['التجمع الخامس', 'الشيخ زايد', '6 أكتوبر', 'المستقبل سيتي', 'العاصمة الإدارية'];

const NAV = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'clients', label: 'العملاء' },
  { key: 'inquiries', label: 'الاستفسارات' },
  { key: 'appointments', label: 'المواعيد' },
  { key: 'properties', label: 'العقارات' },
  { key: 'contracts', label: 'العقود والدفعات' },
  { key: 'brokers', label: 'السماسرة' },
  { key: 'health', label: 'صحة النظام' },
];

const BADGE_MAP = {
  NEW: 'b-new', QUALIFIED: 'b-qual', IN_PROGRESS: 'b-prog', VIP: 'b-vip', LOST: 'b-lost',
  Available: 'b-avail', Reserved: 'b-res', Sold: 'b-sold', Active: 'b-active', Completed: 'b-comp', Pending: 'b-pend',
  CRITICAL: 'b-crit', ERROR: 'b-err', New: 'b-new', Qualified: 'b-qual', Contacted: 'b-prog', Closed: 'b-comp', Lost: 'b-lost',
  Scheduled: 'b-sched', 'On Leave': 'b-res',
};
function Badge({ value }) {
  return <span className={`badge ${BADGE_MAP[value] || ''}`}>{value}</span>;
}

const HOUSE_SVG = (
  <svg viewBox="0 0 220 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="220" height="56" fill="#a6572e" />
    <rect x="30" y="20" width="50" height="36" fill="#c97b4d" />
    <path d="M25 20 55 4 85 20Z" fill="#e0a374" />
    <rect x="100" y="10" width="34" height="46" fill="#8a4324" />
    <rect x="150" y="24" width="46" height="32" fill="#c97b4d" />
    <path d="M146 24 173 10 200 24Z" fill="#e0a374" />
  </svg>
);

function mapClient(c) { return { name: c.name || c.full_name, phone: c.phone, city: c.city, source: c.source, status: c.status || 'NEW', vip: c.status === 'VIP' }; }
function mapProperty(p) { return { title: p.title, city: p.city, type: p.type, price: Number(p.price) || 0, bedrooms: p.bedrooms, status: p.status }; }
function mapInquiry(i) { return { client: i.client_name, prop: i.property_title || '—', source: i.source, intent: i.status, status: i.status, review: String(i.status).toLowerCase() === 'closed' }; }
function mapAppointment(a) { return { client: a.client_name, prop: a.property_id || '—', broker: a.broker || '—', when: `${a.appointment_date || ''} ${a.appointment_time || ''}`.trim(), status: a.status }; }
function mapContract(c) { return { prop: c.property_id, broker: c.employee_id, type: c.contract_type, total: Number(c.total_price) || 0, down: Number(c.down_payment) || 0, status: c.status }; }
function mapPayment(p) { return { contract: p.contract_id, amount: Number(p.amount) || 0, method: p.method, purpose: p.purpose }; }
function mapBroker(b) { return { name: b.name || b.full_name, role: b.role, status: b.status, appts: b.appts || 0, closed: b.closed || 0, value: b.value || 0 }; }

export default function Dashboard() {
  const [page, setPage] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [raw, setRaw] = useState(null);

  const [search, setSearch] = useState('');
  const [clientFilters, setClientFilters] = useState({ status: '', source: '', city: '' });
  const [propFilters, setPropFilters] = useState({ status: '', city: '' });
  const [inqStatus, setInqStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard-data')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRaw(d); })
      .catch((e) => { if (!cancelled) setErr(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const clients = useMemo(() => (raw?.clients || []).map(mapClient), [raw]);
  const properties = useMemo(() => (raw?.properties || []).map(mapProperty), [raw]);
  const inquiries = useMemo(() => (raw?.inquiries || []).map(mapInquiry), [raw]);
  const appointments = useMemo(() => (raw?.appointments || []).map(mapAppointment), [raw]);
  const contracts = useMemo(() => (raw?.contracts || []).map(mapContract), [raw]);
  const payments = useMemo(() => (raw?.payments || []).map(mapPayment), [raw]);
  const brokers = useMemo(() => (raw?.brokers || []).map(mapBroker), [raw]);
  const errors = raw?.errors || [];
  const chartsData = raw?.charts || { revenueByMonth: {}, leadFunnel: {}, leadsBySource: {} };

  const filteredClients = clients.filter((c) =>
    (!clientFilters.status || c.status === clientFilters.status) &&
    (!clientFilters.source || c.source === clientFilters.source) &&
    (!clientFilters.city || c.city === clientFilters.city) &&
    (!search.trim() || c.name?.includes(search) || c.phone?.includes(search))
  );
  const filteredProperties = properties.filter((p) =>
    (!propFilters.status || p.status === propFilters.status) &&
    (!propFilters.city || p.city === propFilters.city) &&
    (!search.trim() || p.title?.includes(search) || p.city?.includes(search))
  );
  const filteredInquiries = inquiries.filter((i) => !inqStatus || i.status === inqStatus);

  const inventoryGroups = useMemo(() => {
    const g = {};
    properties.filter((p) => p.status === 'Available').forEach((p) => {
      g[p.city] = g[p.city] || { count: 0, sum: 0 };
      g[p.city].count++; g[p.city].sum += p.price;
    });
    return g;
  }, [properties]);

  // ── charts ──
  const revenueRef = useRef(null), funnelRef = useRef(null), sourceRef = useRef(null);
  const chartInstances = useRef({});
  useEffect(() => {
    if (!raw) return;
    Chart.defaults.color = '#8a7c67';
    Chart.defaults.font.family = "'Cairo', sans-serif";
    const gridColor = 'rgba(138,124,103,0.15)';

    Object.values(chartInstances.current).forEach((c) => c?.destroy());

    const rbm = chartsData.revenueByMonth || {};
    const months = Object.keys(rbm);
    if (revenueRef.current) {
      chartInstances.current.revenue = new Chart(revenueRef.current, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [
            { label: 'إيجار', data: months.map((m) => rbm[m].rent || 0), backgroundColor: '#a6572e', borderRadius: 6 },
            { label: 'بيع', data: months.map((m) => rbm[m].sale || 0), backgroundColor: '#6d7f57', borderRadius: 6 },
          ],
        },
        options: { plugins: { legend: { labels: { boxWidth: 10 } } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true } } },
      });
    }

    const funnel = chartsData.leadFunnel || {};
    const funnelLabels = Object.keys(funnel);
    if (funnelRef.current) {
      chartInstances.current.funnel = new Chart(funnelRef.current, {
        type: 'doughnut',
        data: { labels: funnelLabels, datasets: [{ data: funnelLabels.map((k) => funnel[k]), backgroundColor: ['#a6572e', '#6d7f57', '#b98a2e', '#c97b4d', '#b4432f'], borderColor: '#faf6ec', borderWidth: 3 }] },
        options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } }, cutout: '62%' },
      });
    }

    const bySource = chartsData.leadsBySource || {};
    const sourceLabels = Object.keys(bySource);
    if (sourceRef.current) {
      chartInstances.current.source = new Chart(sourceRef.current, {
        type: 'bar',
        data: { labels: sourceLabels, datasets: [{ data: sourceLabels.map((k) => bySource[k]), backgroundColor: '#a6572e', borderRadius: 8, barThickness: 30 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: gridColor }, beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    }
    return () => Object.values(chartInstances.current).forEach((c) => c?.destroy());
  }, [raw]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="shell">
      <aside>
        <div className="skyline">
          <svg viewBox="0 0 220 56" preserveAspectRatio="none">
            <rect x="0" y="20" width="24" height="36" fill="#8a4324" /><rect x="26" y="8" width="20" height="48" fill="#c97b4d" />
            <rect x="48" y="26" width="16" height="30" fill="#8a4324" /><rect x="66" y="2" width="22" height="54" fill="#e0a374" />
            <rect x="90" y="18" width="18" height="38" fill="#8a4324" /><rect x="110" y="12" width="24" height="44" fill="#c97b4d" />
            <rect x="136" y="24" width="16" height="32" fill="#8a4324" /><rect x="154" y="6" width="22" height="50" fill="#e0a374" />
            <rect x="178" y="20" width="24" height="36" fill="#c97b4d" /><rect x="204" y="16" width="16" height="40" fill="#8a4324" />
          </svg>
        </div>
        <div className="brand">🏙 لوحة الإدارة</div>
        <div className="navlabel">عام</div>
        <div className="nav">
          {NAV.map((n) => (
            <button key={n.key} className={`nav-item ${page === n.key ? 'active' : ''}`} onClick={() => setPage(n.key)}>
              {n.label}
            </button>
          ))}
        </div>
      </aside>

      <main>
        <div className="topbar">
          <div className="search">
            <input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="avatar">أد</div>
        </div>

        <div className="content">
          {loading && <p className="psub">جاري تحميل البيانات...</p>}
          {err && <p className="psub" style={{ color: 'var(--danger)' }}>تعذر تحميل البيانات: {err}</p>}

          {page === 'overview' && (
            <div className="page active">
              <h1 className="pt">نظرة عامة</h1>
              <p className="psub">ملخص الأداء الحالي</p>
              <div className="kpis">
                <div className="kpi"><div className="label">العملاء</div><div className="value">{clients.length}</div></div>
                <div className="kpi"><div className="label">العقارات المتاحة</div><div className="value">{properties.filter((p) => p.status === 'Available').length}</div></div>
                <div className="kpi"><div className="label">العقود</div><div className="value">{contracts.length}</div></div>
                <div className="kpi flag"><div className="label">تحتاج مراجعة</div><div className="value">{inquiries.filter((i) => i.review).length}</div></div>
              </div>
              <div className="grid2">
                <div className="card"><h2>الإيراد بالشهر <small>v_revenue_by_month</small></h2><div className="chart-box"><canvas ref={revenueRef} /></div></div>
                <div className="card"><h2>مسار العملاء <small>v_lead_funnel</small></h2><div className="chart-box"><canvas ref={funnelRef} /></div></div>
              </div>
              <div className="card"><h2>العملاء حسب المصدر <small>v_leads_by_source</small></h2><div className="chart-box"><canvas ref={sourceRef} /></div></div>
            </div>
          )}

          {page === 'clients' && (
            <div className="page active">
              <h1 className="pt">العملاء</h1>
              <div className="toolbar">
                <select value={clientFilters.status} onChange={(e) => setClientFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">كل الحالات</option>
                  {['NEW', 'QUALIFIED', 'IN_PROGRESS', 'VIP', 'LOST'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={clientFilters.source} onChange={(e) => setClientFilters((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">كل المصادر</option>
                  {['telegram', 'whatsapp', 'instagram', 'messenger'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={clientFilters.city} onChange={(e) => setClientFilters((f) => ({ ...f, city: e.target.value }))}>
                  <option value="">كل المدن</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="card">
                <table>
                  <thead><tr><th></th><th>الاسم</th><th>الهاتف</th><th>المدينة</th><th>المصدر</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {filteredClients.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>لا نتائج</td></tr>}
                    {filteredClients.map((c, i) => (
                      <tr key={i}>
                        <td>{c.vip && <span className="vip-star">★</span>}</td>
                        <td>{c.name}</td><td dir="ltr">{c.phone}</td><td>{c.city}</td><td>{c.source}</td><td><Badge value={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'inquiries' && (
            <div className="page active">
              <h1 className="pt">الاستفسارات</h1>
              <div className="toolbar">
                <select value={inqStatus} onChange={(e) => setInqStatus(e.target.value)}>
                  <option value="">كل الحالات</option>
                  {['New', 'Qualified', 'Contacted', 'Closed', 'Lost'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="card">
                <table>
                  <thead><tr><th>العميل</th><th>العقار</th><th>المصدر</th><th>النية</th><th>الحالة</th><th>مراجعة؟</th></tr></thead>
                  <tbody>
                    {filteredInquiries.map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.client}</td><td>{i.prop}</td><td>{i.source}</td><td>{i.intent}</td>
                        <td><Badge value={i.status} /></td>
                        <td>{i.review ? <span className="badge b-crit">مطلوبة</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'appointments' && (
            <div className="page active">
              <h1 className="pt">المواعيد</h1>
              <div className="card">
                <table>
                  <thead><tr><th>العميل</th><th>العقار</th><th>السمسار</th><th>الموعد</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {appointments.map((a, i) => (
                      <tr key={i}><td>{a.client}</td><td>{a.prop}</td><td>{a.broker}</td><td>{a.when}</td><td><Badge value={a.status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'properties' && (
            <div className="page active">
              <h1 className="pt">العقارات</h1>
              <div className="grid3" id="inventorySummary" style={{ marginBottom: 12 }}>
                {Object.entries(inventoryGroups).map(([city, g]) => (
                  <div className="card" key={city}>
                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginBottom: 6 }}>{city}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{g.count} <small style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--muted)' }}>عقار متاح</small></div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 4 }}>متوسط السعر: {Math.round(g.sum / g.count).toLocaleString('en-US')} ج.م</div>
                  </div>
                ))}
              </div>
              <div className="toolbar">
                <select value={propFilters.status} onChange={(e) => setPropFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">كل الحالات</option>
                  {['Available', 'Reserved', 'Sold'].map((s) => <option key={s}>{s}</option>)}
                </select>
                <select value={propFilters.city} onChange={(e) => setPropFilters((f) => ({ ...f, city: e.target.value }))}>
                  <option value="">كل المدن</option>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="propgrid">
                {filteredProperties.map((p, i) => (
                  <div className="propcard" key={i}>
                    <div className="thumb">{HOUSE_SVG}</div>
                    <div className="body">
                      <div className="title">{p.title}</div>
                      <div className="meta">{p.city} · {p.type} · {p.bedrooms || '—'} غرف</div>
                      <div style={{ marginTop: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{p.price.toLocaleString('en-US')}</strong><Badge value={p.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {page === 'contracts' && (
            <div className="page active">
              <h1 className="pt">العقود والدفعات</h1>
              <div className="card" style={{ marginBottom: 12 }}>
                <h2>العقود</h2>
                <table>
                  <thead><tr><th>العقار</th><th>السمسار</th><th>النوع</th><th>القيمة</th><th>المقدم</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {contracts.map((c, i) => (
                      <tr key={i}><td>{c.prop}</td><td>{c.broker}</td><td>{c.type}</td><td>{c.total.toLocaleString('en-US')}</td><td>{c.down.toLocaleString('en-US')}</td><td><Badge value={c.status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h2>الدفعات</h2>
                <table>
                  <thead><tr><th>العقد</th><th>المبلغ</th><th>الطريقة</th><th>الغرض</th></tr></thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={i}><td>{p.contract}</td><td>{p.amount.toLocaleString('en-US')}</td><td>{p.method}</td><td>{p.purpose}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'brokers' && (
            <div className="page active">
              <h1 className="pt">السماسرة</h1>
              <div className="card">
                <table>
                  <thead><tr><th>الاسم</th><th>الدور</th><th>الحالة</th><th>مواعيد</th><th>عقود مغلقة</th><th>قيمة المبيعات</th></tr></thead>
                  <tbody>
                    {brokers.map((b, i) => (
                      <tr key={i}><td>{b.name}</td><td>{b.role}</td><td><Badge value={b.status} /></td><td>{b.appts}</td><td>{b.closed}</td><td>{b.value ? b.value + 'م' : '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'health' && (
            <div className="page active">
              <h1 className="pt">صحة النظام</h1>
              <div className="card">
                <table>
                  <thead><tr><th>الوركفلو</th><th>العقدة</th><th>الرسالة</th><th>الخطورة</th></tr></thead>
                  <tbody>
                    {errors.map((e, i) => (
                      <tr key={i}><td>{e.wf}</td><td>{e.node}</td><td>{e.msg}</td><td><Badge value={e.sev} /></td></tr>
                    ))}
                    {errors.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>لا أخطاء</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
