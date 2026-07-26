import { CommandCenterHero } from '../components/dashboard/CommandCenterHero';
import { DepartmentDashboard } from '../components/dashboard/DepartmentDashboard';
import { BusinessCharts } from '../components/dashboard/BusinessCharts';
import { ActivityAndActions } from '../components/dashboard/ActivityAndActions';
import { AlertBanner } from '../components/dashboard/AlertBanner';
import { UpcomingJobsTable } from '../components/dashboard/UpcomingJobsTable';

export function DashboardPage() {
  return (
    <div className="grid gap-6">
      <CommandCenterHero />
      <DepartmentDashboard />
      <BusinessCharts />
      <AlertBanner />
      <ActivityAndActions />
      <UpcomingJobsTable />
    </div>
  );
}
