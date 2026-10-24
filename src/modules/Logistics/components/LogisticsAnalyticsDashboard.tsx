import React, { useState, useRef } from 'react';
import type { UnifiedLogisticsOrder } from '../../../types/unifiedLogistics';
import type { LogisticsFilterState } from '../types/logisticsFilters';
import { LogisticsFilterBar, AnalyticsSectionKey } from './analytics/LogisticsFilterBar';
import { LogisticsKpiGrid } from './analytics/LogisticsKpiGrid';
import { DeliveryStatusSection } from './analytics/DeliveryStatusSection';
import { RtoIntelligenceSection } from './analytics/RtoIntelligenceSection';
import { CourierPerformanceSection } from './analytics/CourierPerformanceSection';
import { DeliverySlaSection } from './analytics/DeliverySlaSection';
import { CodReconciliationSection } from './analytics/CodReconciliationSection';
import { GeographicLogisticsSection } from './analytics/GeographicLogisticsSection';
import { LogisticsWorkloadForecastSection } from './analytics/LogisticsWorkloadForecastSection';
import { TrackingExceptionsSection } from './analytics/TrackingExceptionsSection';
import { LogisticsFullPageDetailView } from './analytics/LogisticsFullPageDetailView';

export interface LogisticsAnalyticsDashboardProps {
  orders: UnifiedLogisticsOrder[];
  allOrders: UnifiedLogisticsOrder[];
  filters: LogisticsFilterState;
  onResetFilters: () => void;
  onUpdateFilters?: (updater: (prev: LogisticsFilterState) => LogisticsFilterState) => void;
  onNavigateStage?: (stage: 'active' | 'prepare_dispatch' | 'dispatched' | 'tracking') => void;
  onOpenDateCalendar?: () => void;
  onTrackOrder?: (order: any) => void;
  onViewCustomer?: (customerKey: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const LogisticsAnalyticsDashboard: React.FC<LogisticsAnalyticsDashboardProps> = ({
  orders,
  allOrders,
  filters,
  onResetFilters,
  onUpdateFilters = () => {},
  onNavigateStage,
  onOpenDateCalendar = () => {},
  onTrackOrder,
  onViewCustomer,
  onRefresh,
  isRefreshing = false
}) => {
  // Navigation: Active Section
  const [activeSection, setActiveSection] = useState<AnalyticsSectionKey>('overview');

  // Drill-Down Modal / Full Page View State
  const [drillDown, setDrillDown] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    filterFn: (o: UnifiedLogisticsOrder) => boolean;
  } | null>(null);

  // Section Refs for smooth scrolling
  const overviewRef = useRef<HTMLDivElement>(null);
  const deliveryStatusRef = useRef<HTMLDivElement>(null);
  const rtoRef = useRef<HTMLDivElement>(null);
  const courierRef = useRef<HTMLDivElement>(null);
  const slaRef = useRef<HTMLDivElement>(null);
  const codRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<HTMLDivElement>(null);
  const forecastRef = useRef<HTMLDivElement>(null);
  const exceptionsRef = useRef<HTMLDivElement>(null);

  const handleSelectSection = (section: AnalyticsSectionKey) => {
    setActiveSection(section);
    const refMap: Record<AnalyticsSectionKey, React.RefObject<HTMLDivElement | null>> = {
      overview: overviewRef,
      delivery_status: deliveryStatusRef,
      rto_intelligence: rtoRef,
      courier_performance: courierRef,
      sla_delays: slaRef,
      cod_reconciliation: codRef,
      geographic: geoRef,
      operations_forecasting: forecastRef,
      tracking_exceptions: exceptionsRef
    };

    const targetRef = refMap[section];
    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleOpenDrillDown = (
    title: string,
    subtitle: string,
    filterFn: (o: UnifiedLogisticsOrder) => boolean
  ) => {
    setDrillDown({
      isOpen: true,
      title,
      subtitle,
      filterFn
    });
  };

  // If Drill-Down View is open, render the Full Page Detail View
  if (drillDown && drillDown.isOpen) {
    const drillDownOrders = orders.filter(drillDown.filterFn);
    return (
      <LogisticsFullPageDetailView
        title={drillDown.title}
        subtitle={drillDown.subtitle}
        orders={drillDownOrders}
        onClose={() => setDrillDown(null)}
        onTrackOrder={onTrackOrder}
        onViewCustomer={onViewCustomer}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-12 custom-scrollbar text-slate-200 pr-1">
      
      {/* 1. COMPACT ANALYTICS FILTER BAR & QUICK SECTION TABS */}
      <LogisticsFilterBar
        filters={filters}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onUpdateFilters={onUpdateFilters}
        onResetFilters={onResetFilters}
        onOpenDateCalendar={onOpenDateCalendar}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />

      {/* 2. SECTION 1: LOGISTICS OVERVIEW (20 KPI CARDS) */}
      <div ref={overviewRef} className="scroll-mt-4">
        <LogisticsKpiGrid
          orders={orders}
          allOrders={allOrders}
          filters={filters}
          onDrillDown={handleOpenDrillDown}
          onNavigateStage={onNavigateStage}
        />
      </div>

      {/* 3. SECTION 2: DELIVERY PERFORMANCE & STATUS ANALYTICS (13 CANONICAL STATUSES) */}
      <div ref={deliveryStatusRef} className="scroll-mt-4">
        <DeliveryStatusSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

      {/* 4. SECTION 3: RTO INTELLIGENCE */}
      <div ref={rtoRef} className="scroll-mt-4">
        <RtoIntelligenceSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

      {/* 5. SECTION 4: COURIER PARTNER PERFORMANCE */}
      <div ref={courierRef} className="scroll-mt-4">
        <CourierPerformanceSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

      {/* 6. SECTION 5: DELIVERY SLA & DELAY ANALYTICS */}
      <div ref={slaRef} className="scroll-mt-4">
        <DeliverySlaSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

      {/* 7. SECTION 6: COD & FINANCIAL RECONCILIATION */}
      <div ref={codRef} className="scroll-mt-4">
        <CodReconciliationSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

      {/* 8. SECTION 7: GEOGRAPHIC LOGISTICS ANALYTICS */}
      <div ref={geoRef} className="scroll-mt-4">
        <GeographicLogisticsSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

      {/* 9. SECTION 8: WORKLOAD & OPERATIONAL FORECASTING */}
      <div ref={forecastRef} className="scroll-mt-4">
        <LogisticsWorkloadForecastSection
          orders={orders}
          onDrillDown={handleOpenDrillDown}
          onNavigateStage={onNavigateStage}
        />
      </div>

      {/* 10. SECTION 9: TRACKING & EXCEPTION INTELLIGENCE */}
      <div ref={exceptionsRef} className="scroll-mt-4">
        <TrackingExceptionsSection
          orders={orders}
          onTrackOrder={onTrackOrder}
          onViewCustomer={onViewCustomer}
          onDrillDown={handleOpenDrillDown}
        />
      </div>

    </div>
  );
};
