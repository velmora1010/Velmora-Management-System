import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { CustomerRepeatAnalyticsDashboard } from '../../../components/analytics/CustomerRepeatAnalyticsDashboard';
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

const STORAGE_KEY_NAV = 'velmora_logistics_analytics_nav';

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

  // Scroll Container Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State preservation refs
  const savedScrollTopRef = useRef<number>(0);
  const savedActiveSectionRef = useRef<AnalyticsSectionKey>('overview');
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const isClosingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Section Refs for smooth scrolling & viewport detection
  const overviewRef = useRef<HTMLDivElement>(null);
  const deliveryStatusRef = useRef<HTMLDivElement>(null);
  const rtoRef = useRef<HTMLDivElement>(null);
  const courierRef = useRef<HTMLDivElement>(null);
  const slaRef = useRef<HTMLDivElement>(null);
  const codRef = useRef<HTMLDivElement>(null);
  const geoRef = useRef<HTMLDivElement>(null);
  const customerRepeatRef = useRef<HTMLDivElement>(null);
  const exceptionsRef = useRef<HTMLDivElement>(null);

  // Helper to scroll to a section by key
  const handleSelectSection = (section: AnalyticsSectionKey) => {
    setActiveSection(section);
    savedActiveSectionRef.current = section;
    isProgrammaticScrollRef.current = true;

    const refMap: Record<AnalyticsSectionKey, React.RefObject<HTMLDivElement | null>> = {
      overview: overviewRef,
      delivery_status: deliveryStatusRef,
      rto_intelligence: rtoRef,
      courier_performance: courierRef,
      sla_delays: slaRef,
      cod_reconciliation: codRef,
      geographic: geoRef,
      customer_repeat: customerRepeatRef,
      tracking_exceptions: exceptionsRef
    };

    const targetRef = refMap[section];
    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
      if (scrollContainerRef.current) {
        savedScrollTopRef.current = scrollContainerRef.current.scrollTop;
      }
    }, 700);
  };

  // Track scroll position and detect active section in viewport
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (drillDown?.isOpen) return;

    const container = e.currentTarget;
    savedScrollTopRef.current = container.scrollTop;

    if (isProgrammaticScrollRef.current) return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (isProgrammaticScrollRef.current || !scrollContainerRef.current) return;

      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const offsetThreshold = containerRect.top + 160;

      const sections: { key: AnalyticsSectionKey; ref: React.RefObject<HTMLDivElement | null> }[] = [
        { key: 'overview', ref: overviewRef },
        { key: 'delivery_status', ref: deliveryStatusRef },
        { key: 'rto_intelligence', ref: rtoRef },
        { key: 'courier_performance', ref: courierRef },
        { key: 'sla_delays', ref: slaRef },
        { key: 'cod_reconciliation', ref: codRef },
        { key: 'geographic', ref: geoRef },
        { key: 'customer_repeat', ref: customerRepeatRef },
        { key: 'tracking_exceptions', ref: exceptionsRef }
      ];

      let currentKey: AnalyticsSectionKey = 'overview';
      for (const sec of sections) {
        if (sec.ref.current) {
          const rect = sec.ref.current.getBoundingClientRect();
          if (rect.top <= offsetThreshold) {
            currentKey = sec.key;
          }
        }
      }

      setActiveSection((prev) => {
        if (prev !== currentKey) {
          savedActiveSectionRef.current = currentKey;
          return currentKey;
        }
        return prev;
      });
    }, 80);
  };

  // Close drill-down and restore scroll position with multi-frame reinforcement
  const doCloseDrillDown = useCallback((restoredScroll?: number, restoredSection?: AnalyticsSectionKey) => {
    isClosingRef.current = true;
    const targetScroll = typeof restoredScroll === 'number' ? restoredScroll : (savedScrollTopRef.current ?? 0);
    const targetSection = restoredSection || savedActiveSectionRef.current || 'overview';

    setDrillDown(null);
    setActiveSection(targetSection);

    try {
      sessionStorage.removeItem(STORAGE_KEY_NAV);
    } catch {
      // ignore
    }

    const applyScroll = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = targetScroll;
      }
    };

    // Immediate scroll restore
    applyScroll();

    // Multi-frame reinforcement to prevent layout shifts or chart re-renders from jumping
    requestAnimationFrame(() => {
      applyScroll();
      setTimeout(applyScroll, 40);
      setTimeout(applyScroll, 120);
      setTimeout(applyScroll, 250);
      setTimeout(() => {
        isClosingRef.current = false;
      }, 350);
    });
  }, []);

  // Back button handler: use history.back() if history entry exists, else direct close
  const handleCloseDrillDown = useCallback(() => {
    if (isClosingRef.current) return;
    if (window.history.state?.isLogisticsAnalyticsDrillDown) {
      window.history.back();
    } else {
      doCloseDrillDown();
    }
  }, [doCloseDrillDown]);

  // Open drill-down: capture exact scroll position, update history and session storage
  const handleOpenDrillDown = (
    title: string,
    subtitle: string,
    filterFn: (o: UnifiedLogisticsOrder) => boolean
  ) => {
    const currentScrollTop = scrollContainerRef.current?.scrollTop || 0;
    savedScrollTopRef.current = currentScrollTop;
    savedActiveSectionRef.current = activeSection;

    try {
      sessionStorage.setItem(STORAGE_KEY_NAV, JSON.stringify({
        scrollTop: currentScrollTop,
        activeSection: activeSection,
        timestamp: Date.now()
      }));
    } catch {
      // ignore
    }

    // Push history state so browser Back button closes drill-down seamlessly
    window.history.pushState(
      { isLogisticsAnalyticsDrillDown: true, scrollTop: currentScrollTop, activeSection },
      ''
    );

    setDrillDown({
      isOpen: true,
      title,
      subtitle,
      filterFn
    });
  };

  // Popstate listener for native browser Back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (drillDown?.isOpen) {
        const state = e.state;
        const targetScroll = typeof state?.scrollTop === 'number' ? state.scrollTop : savedScrollTopRef.current;
        const targetSection = state?.activeSection || savedActiveSectionRef.current;
        doCloseDrillDown(targetScroll, targetSection);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [drillDown, doCloseDrillDown]);

  // Clean up any timers on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      
      {/* MAIN SCROLLABLE ANALYTICS DASHBOARD CONTAINER */}
      <div
        ref={scrollContainerRef}
        data-testid="logistics-analytics-scroll-container"
        onScroll={handleScroll}
        className={`flex-1 min-h-0 overflow-y-auto space-y-6 pb-12 custom-scrollbar text-slate-200 pr-1 ${
          drillDown?.isOpen ? 'invisible pointer-events-none' : ''
        }`}
      >
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

        {/* 9. CUSTOMER REPEAT & GEOGRAPHIC ANALYTICS */}
        <div ref={customerRepeatRef} className="scroll-mt-4">
          <CustomerRepeatAnalyticsDashboard sourceChannel="WEBSITE" />
        </div>

        {/* 10. SECTION 8: TRACKING & EXCEPTION INTELLIGENCE */}
        <div ref={exceptionsRef} className="scroll-mt-4">
          <TrackingExceptionsSection
            orders={orders}
            onTrackOrder={onTrackOrder}
            onViewCustomer={onViewCustomer}
            onDrillDown={handleOpenDrillDown}
          />
        </div>
      </div>

      {/* FULL PAGE DRILL-DOWN OVERLAY */}
      {drillDown?.isOpen && (
        <div className="absolute inset-0 z-30 bg-[#070d18] flex flex-col min-h-0 overflow-hidden">
          <LogisticsFullPageDetailView
            title={drillDown.title}
            subtitle={drillDown.subtitle}
            orders={orders.filter(drillDown.filterFn)}
            onClose={handleCloseDrillDown}
            onTrackOrder={onTrackOrder}
            onViewCustomer={onViewCustomer}
          />
        </div>
      )}

    </div>
  );
};
