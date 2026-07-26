import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth } from './components/auth/RequireAuth';
import { RequireTenant } from './components/auth/RequireTenant';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';

/**
 * Code-split every page except the landing/auth shells + dashboard. Each
 * route lazy-loads on first navigation; vendor chunk + dashboard form the
 * initial download.
 */
const lazyPage = (load: () => Promise<{ [k: string]: any }>, exportName: string) =>
  lazy(async () => {
    const mod = await load();
    return { default: mod[exportName] };
  });

const WorkshopPage        = lazyPage(() => import('./pages/WorkshopPage'),        'WorkshopPage');
const VehiclesPage        = lazyPage(() => import('./pages/VehiclesPage'),        'VehiclesPage');
const InventoryPage       = lazyPage(() => import('./pages/InventoryPage'),       'InventoryPage');
const SalesPage           = lazyPage(() => import('./pages/SalesPage'),           'SalesPage');
const POSPage             = lazyPage(() => import('./pages/POSPage'),             'POSPage');
const SalesLedgerPage     = lazyPage(() => import('./pages/SalesLedgerPage'),     'SalesLedgerPage');
const ExpensesPage        = lazyPage(() => import('./pages/ExpensesPage'),        'ExpensesPage');
const PurchaseOrdersPage  = lazyPage(() => import('./pages/PurchaseOrdersPage'),  'PurchaseOrdersPage');
const CustomersPage       = lazyPage(() => import('./pages/CustomersPage'),       'CustomersPage');
const RemindersPage       = lazyPage(() => import('./pages/RemindersPage'),       'RemindersPage');
const FixBotPage          = lazyPage(() => import('./pages/FixBotPage'),          'FixBotPage');
const ReportsPage         = lazyPage(() => import('./pages/ReportsPage'),         'ReportsPage');
const HRPage              = lazyPage(() => import('./pages/HRPage'),              'HRPage');
const PayrollPage         = lazyPage(() => import('./pages/PayrollPage'),         'PayrollPage');
const FinancePage         = lazyPage(() => import('./pages/FinancePage'),         'FinancePage');
const SubscriptionsPage   = lazyPage(() => import('./pages/SubscriptionsPage'),   'SubscriptionsPage');
const IntegrationsPage    = lazyPage(() => import('./pages/IntegrationsPage'),    'IntegrationsPage');
const SettingsPage        = lazyPage(() => import('./pages/SettingsPage'),        'SettingsPage');
const AdminPage           = lazyPage(() => import('./pages/AdminPage'),           'AdminPage');
const NotificationsPage   = lazyPage(() => import('./pages/NotificationsPage'),   'NotificationsPage');
const AuditPage           = lazyPage(() => import('./pages/AuditPage'),           'AuditPage');
const ExportCenterPage    = lazyPage(() => import('./pages/ExportCenterPage'),    'ExportCenterPage');
const RecallsPage         = lazyPage(() => import('./pages/RecallsPage'),         'RecallsPage');
const TenantsPage         = lazyPage(() => import('./pages/TenantsPage'),         'TenantsPage');
const VsrDetailPage       = lazyPage(() => import('./pages/VsrDetailPage'),       'VsrDetailPage');
const InventoryLogPage    = lazyPage(() => import('./pages/InventoryLogPage'),    'InventoryLogPage');
const CreditorsPage       = lazyPage(() => import('./pages/CreditorsPage'),       'CreditorsPage');
const ClockInOutPage      = lazyPage(() => import('./pages/ClockInOutPage'),      'ClockInOutPage');
const ExpensesHubPage     = lazyPage(() => import('./pages/ExpensesHubPage'),     'ExpensesHubPage');
const DataArchivesPage    = lazyPage(() => import('./pages/DataArchivesPage'),    'DataArchivesPage');
const ComplaintsPage      = lazyPage(() => import('./pages/ComplaintsPage'),      'ComplaintsPage');
const PrintJobCardPage    = lazyPage(() => import('./pages/PrintJobCardPage'),    'PrintJobCardPage');
const PrintInvoicePage    = lazyPage(() => import('./pages/PrintInvoicePage'),    'PrintInvoicePage');
const PrintSalesReportPage= lazyPage(() => import('./pages/PrintSalesReportPage'),'PrintSalesReportPage');
const PrintComplaintPage  = lazyPage(() => import('./pages/PrintComplaintPage'),  'PrintComplaintPage');
const DailyEntryPage      = lazyPage(() => import('./pages/DailyEntryPage'),      'DailyEntryPage');
const SchedulesPage       = lazyPage(() => import('./pages/SchedulesPage'),       'SchedulesPage');
const TrainingPage        = lazyPage(() => import('./pages/TrainingPage'),        'TrainingPage');
const MechanicTrackerPage = lazyPage(() => import('./pages/MechanicTrackerPage'), 'MechanicTrackerPage');
const MarketingPage       = lazyPage(() => import('./pages/MarketingPage'),       'MarketingPage');
const StaffPortalPage     = lazyPage(() => import('./pages/StaffPortalPage'),     'StaffPortalPage');
const StaffKioskPage      = lazyPage(() => import('./pages/StaffPortalPage'),     'StaffKioskPage');

function PageFallback() {
  return (
    <div className="grid place-items-center py-12 text-ink-700 font-sans text-sm">
      <Loader2 className="animate-spin" />
    </div>
  );
}

function AppRoutes() {
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/"                element={<DashboardPage />} />
            <Route path="/workshop"        element={<WorkshopPage />} />
            <Route path="/vehicles"        element={<VehiclesPage />} />
            <Route path="/inventory"       element={<InventoryPage />} />
            <Route path="/sales"           element={<SalesPage />} />
            <Route path="/pos"             element={<POSPage />} />
            <Route path="/sales-ledger"    element={<SalesLedgerPage />} />
            <Route path="/expenses"        element={<ExpensesPage />} />
            <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="/customers"       element={<CustomersPage />} />
            <Route path="/reminders"       element={<RemindersPage />} />
            <Route path="/fixbot"          element={<FixBotPage />} />
            <Route path="/reports"         element={<ReportsPage />} />
            <Route path="/hr"              element={<HRPage />} />
            <Route path="/payroll"         element={<PayrollPage />} />
            <Route path="/finance"         element={<FinancePage />} />
            <Route path="/subscriptions"   element={<SubscriptionsPage />} />
            <Route path="/integrations"    element={<IntegrationsPage />} />
            <Route path="/settings"        element={<SettingsPage />} />
            <Route path="/admin"           element={<AdminPage />} />
            <Route path="/recalls"         element={<RecallsPage />} />
            <Route path="/vsr/:id"         element={<VsrDetailPage />} />
            <Route path="/inventory-log"   element={<InventoryLogPage />} />
            <Route path="/creditors"       element={<CreditorsPage />} />
            <Route path="/clock"           element={<Navigate to="/hr?tab=clock" replace />} />
            <Route path="/expenses-hub"    element={<ExpensesHubPage />} />
            <Route path="/complaints"      element={<ComplaintsPage />} />
            <Route path="/daily-entry"     element={<DailyEntryPage />} />
            <Route path="/data-archives"   element={<DataArchivesPage />} />
            <Route path="/schedules"       element={<SchedulesPage />} />
            <Route path="/training"        element={<TrainingPage />} />
            <Route path="/mechanic-tracker" element={<MechanicTrackerPage />} />
            <Route path="/marketing"       element={<MarketingPage />} />
            <Route path="/print/jobcard/:id"    element={<PrintJobCardPage />} />
            <Route path="/print/invoice/:id"    element={<PrintInvoicePage />} />
            <Route path="/print/sales-report"   element={<PrintSalesReportPage />} />
            <Route path="/complaints/:id/print" element={<PrintComplaintPage />} />
            <Route path="/tenants"         element={<TenantsPage />} />
            <Route path="/audit"           element={<AuditPage />} />
            <Route path="/exports"         element={<ExportCenterPage />} />
            <Route path="/notifications"   element={<NotificationsPage />} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

function ProtectedTenantScreen({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireTenant>
        <ErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </RequireTenant>
    </RequireAuth>
  );
}

export default function App() {
  const host = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  const isStaffHost = host === 'staff.agl.software' || host.startsWith('staff.');

  if (isStaffHost) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route path="/kiosk" element={<ProtectedTenantScreen><StaffKioskPage /></ProtectedTenantScreen>} />
        <Route path="/fixbot" element={<ProtectedTenantScreen><FixBotPage /></ProtectedTenantScreen>} />
        <Route path="/*" element={<ProtectedTenantScreen><StaffPortalPage /></ProtectedTenantScreen>} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login"   element={<LoginPage />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />
      <Route path="/staff/login" element={<LoginPage />} />
      <Route path="/staff/kiosk" element={<ProtectedTenantScreen><StaffKioskPage /></ProtectedTenantScreen>} />
      <Route path="/staff/*" element={<ProtectedTenantScreen><StaffPortalPage /></ProtectedTenantScreen>} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <RequireTenant>
              <AppRoutes />
            </RequireTenant>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
