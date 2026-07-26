import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, LayoutDashboard, FileText } from 'lucide-react';
import { BusinessReportPage } from './reports/BusinessReportPage';
import { BIDashboardPage } from './reports/BIDashboardPage';
import { FormsPage } from './reports/FormsPage';

/**
 * Reports shell — three sub-sections per WS4:
 *   • Business Reporting (default)
 *   • Dashboard (Manager BI, role-gated inside)
 *   • Forms (form library + signatures)
 *
 * Tab state mirrors the URL so the sidebar deep-links resolve directly.
 */
type Tab = 'business' | 'dashboard' | 'forms';
const TABS: ReadonlyArray<Tab> = ['business', 'dashboard', 'forms'];

export function ReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab: Tab = (() => {
    const t = new URLSearchParams(location.search).get('tab') ?? 'business';
    return (TABS as readonly string[]).includes(t) ? (t as Tab) : 'business';
  })();
  const setTab = (next: Tab) => navigate(next === 'business' ? '/reports' : `/reports?tab=${next}`);

  return (
    <div className="max-w-7xl">
      <header className="mb-4">
        <h1 className="h-section flex items-center gap-2"><BarChart3 size={20}/> Reports</h1>
        <p className="mt-1 text-neutral-600 text-sm">Periodic reports, manager BI dashboard, and the in-app form library.</p>
      </header>

      <nav className="flex items-center gap-1 mb-5 bg-white border border-line rounded-2xl p-1 w-fit">
        <TabBtn id="business"  label="Business Reporting" icon={BarChart3}      active={tab === 'business'}  onClick={setTab}/>
        <TabBtn id="dashboard" label="Dashboard"          icon={LayoutDashboard} active={tab === 'dashboard'} onClick={setTab}/>
        <TabBtn id="forms"     label="Forms"              icon={FileText}        active={tab === 'forms'}     onClick={setTab}/>
      </nav>

      {tab === 'business'  && <BusinessReportPage/>}
      {tab === 'dashboard' && <BIDashboardPage/>}
      {tab === 'forms'     && <FormsPage/>}
    </div>
  );
}

function TabBtn({ id, label, icon: Icon, active, onClick }: { id: Tab; label: string; icon: any; active: boolean; onClick: (t: Tab) => void }) {
  return (
    <button type="button" onClick={() => onClick(id)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
        active ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
      }`}>
      <Icon size={14}/> {label}
    </button>
  );
}
