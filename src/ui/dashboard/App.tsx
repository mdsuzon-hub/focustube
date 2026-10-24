import { useEffect, useState } from 'react';
import {
  BarChart3,
  Gauge,
  LayoutDashboard,
  ListVideo,
  Search,
  Settings as Cog,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { ErrorBanner, Loading, Toast } from '../components';
import { useAction, useAppearance, useAppState, useNow, useToast } from '../store';
import { FocusPage } from './Focus';
import { InsightsPage } from './Insights';
import { OverviewPage } from './Overview';
import { QueuePage } from './Queue';
import { RulesPage } from './Rules';
import { SearchPage } from './Search';
import { SettingsPage } from './Settings';

const PAGES = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'focus', label: 'Focus', icon: Gauge },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'queue', label: 'Queue', icon: ListVideo },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'rules', label: 'Rules', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', icon: Cog },
] as const;
type PageId = (typeof PAGES)[number]['id'];

function currentPage(): PageId {
  const id = window.location.hash.replace(/^#\/?/, '');
  return PAGES.some((p) => p.id === id) ? (id as PageId) : 'overview';
}

export function DashboardApp() {
  const { state, error } = useAppState();
  useAppearance(state?.settings);
  const toast = useToast();
  const act = useAction(toast.notify);
  const now = useNow(1000);
  const [page, setPage] = useState<PageId>(currentPage);

  useEffect(() => {
    const on = (): void => setPage(currentPage());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title = `${PAGES.find((p) => p.id === page)?.label ?? 'Dashboard'} · FocusTube`;
  }, [page]);

  const props = state ? { ...state, now, act } : null;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            <Target size={18} />
          </div>
          <div>
            <h1 style={{ fontSize: 17 }}>FocusTube</h1>
            <div className="tag">Watch with purpose.</div>
          </div>
        </div>
        <nav className="nav" aria-label="Dashboard">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={page === id ? 'page' : undefined}>
              <Icon size={16} aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main">
        {error && <ErrorBanner text={`Storage problem: ${error}`} />}
        {!props ? (
          <Loading />
        ) : (
          <>
            {page === 'overview' && <OverviewPage {...props} />}
            {page === 'focus' && <FocusPage {...props} />}
            {page === 'search' && <SearchPage {...props} />}
            {page === 'queue' && <QueuePage {...props} />}
            {page === 'insights' && <InsightsPage {...props} />}
            {page === 'rules' && <RulesPage {...props} />}
            {page === 'settings' && <SettingsPage {...props} notify={toast.notify} />}
          </>
        )}
      </main>
      <Toast text={toast.text} kind={toast.kind} />
    </div>
  );
}
