import React, { Suspense, lazy } from 'react';

const ProjectDashboardManagerReadyPackageCorePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageCorePanels.jsx'));
const ProjectDashboardManagerReadyPackageOperationalPanels = lazy(() => import('./ProjectDashboardManagerReadyPackageOperationalPanels.jsx'));

export default function ProjectDashboardManagerReadyPackageSnapshot({ view }) {
  if (!view) return null;

  return (
    <div data-testid="backend-manager-ready-package-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Ready Package</div>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageCorePanels view={view.core} />
      </Suspense>
      <Suspense fallback={view.fallback}>
        <ProjectDashboardManagerReadyPackageOperationalPanels view={view.operational} />
      </Suspense>
    </div>
  );
}
