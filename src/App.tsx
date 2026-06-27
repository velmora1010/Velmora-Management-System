import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { OperationsLayout } from './layouts/OperationsLayout';
import { FinanceLayout } from './layouts/FinanceLayout';
import { InventoryLayout } from './layouts/InventoryLayout';
import { ErrorBoundary } from './components/system/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/system/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { 
  TrendingUp, FolderOpen, 
  Lightbulb, Users, Tag
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Lazy loaded routes for better performance
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const PurchaseOrderPage = lazy(() => import('./pages/PurchaseOrderPage').then(module => ({ default: module.PurchaseOrderPage })));
const POHistoryPage = lazy(() => import('./pages/POHistoryPage').then(module => ({ default: module.POHistoryPage })));
const VendorManagement = lazy(() => import('./pages/VendorManagement').then(module => ({ default: module.VendorManagement })));

const FinanceBills = lazy(() => import('./modules/finance/FinanceBills').then(module => ({ default: module.FinanceBills })));
const FinanceExpense = lazy(() => import('./modules/finance/FinanceExpense').then(module => ({ default: module.FinanceExpense })));
const FinanceCategoryManagement = lazy(() => import('./modules/finance/FinanceCategoryManagement').then(module => ({ default: module.FinanceCategoryManagement })));
const FinanceManagementLayout = lazy(() => import('./modules/finance/FinanceManagementLayout').then(module => ({ default: module.FinanceManagementLayout })));
const TaskManager = lazy(() => import('./modules/tasks/TaskManager').then(module => ({ default: module.TaskManager })));
const MarketingHome = lazy(() => import('./modules/marketing/MarketingHome').then(module => ({ default: module.MarketingHome })));

const InventoryDashboard = lazy(() => import('./modules/inventory/InventoryDashboard').then(module => ({ default: module.InventoryDashboard })));
const RawMaterial = lazy(() => import('./modules/inventory/RawMaterial').then(module => ({ default: module.RawMaterial })));
const Production = lazy(() => import('./modules/inventory/Production').then(module => ({ default: module.Production })));
const Combos = lazy(() => import('./modules/inventory/combos/Combos').then(module => ({ default: module.Combos })));
const CreateCombo = lazy(() => import('./modules/inventory/combos/CreateCombo').then(module => ({ default: module.CreateCombo })));
const InventoryRoom = lazy(() => import('./modules/inventory/InventoryRoom'));
const ViewBarcode = lazy(() => import('./modules/inventory/ViewBarcode').then(module => ({ default: module.ViewBarcode })));
const QCBarcodeList = lazy(() => import('./modules/inventory/quality-check/QCBarcodeList').then(module => ({ default: module.QCBarcodeList })));
const BackupRestore = lazy(() => import('./modules/system/BackupRestore').then(module => ({ default: module.BackupRestore })));

// Customer Tickets
const CustomerTicketsLayout = lazy(() => import('./layouts/CustomerTicketsLayout').then(module => ({ default: module.CustomerTicketsLayout })));
const CustomerTicketsDashboard = lazy(() => import('./modules/customer-tickets/CustomerTicketsDashboard').then(module => ({ default: module.CustomerTicketsDashboard })));
const OpenTickets = lazy(() => import('./modules/customer-tickets/OpenTickets').then(module => ({ default: module.OpenTickets })));
const ResolvedTickets = lazy(() => import('./modules/customer-tickets/ResolvedTickets').then(module => ({ default: module.ResolvedTickets })));
const AddTicket = lazy(() => import('./modules/customer-tickets/AddTicket').then(module => ({ default: module.AddTicket })));
const TicketDetails = lazy(() => import('./modules/customer-tickets/TicketDetails').then(module => ({ default: module.TicketDetails })));

// Fallback loader
const RouteLoader = () => (
  <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="bottom-right" toastOptions={{
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155'
            }
          }} />
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes inside MainLayout */}
              <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                  {/* Home Landing Page */}
                  <Route path="/" element={<HomePage />} />
                  
                  {/* Dashboard */}
                  <Route path="/dashboard" element={<DashboardPage />} />
                  
                  {/* Operations Department */}
                  <Route path="/operations" element={<OperationsLayout />}>
                    <Route index element={<Navigate to="/operations/vendors" replace />} />
                    {/* Role restrictions temporarily removed for single-login */}
                    <Route element={<ProtectedRoute />}>
                      <Route path="vendors" element={<VendorManagement />} />
                    </Route>
                  </Route>

                  {/* Finance Department */}
                  <Route path="/finance" element={<FinanceLayout />}>
                    <Route index element={<Navigate to="/finance/management" replace />} />
                    
                    <Route path="management" element={<FinanceManagementLayout />}>
                      <Route index element={<Navigate to="bills" replace />} />
                      <Route path="bills" element={<FinanceBills />} />
                      <Route path="expense" element={<FinanceExpense />} />
                      
                      <Route element={<ProtectedRoute />}>
                        <Route path="purchase-order" element={<PurchaseOrderPage />} />
                      </Route>
                      
                      <Route path="po-history" element={<POHistoryPage />} />
                      
                      <Route path="bank-account" element={<PlaceholderPage title="Bank Account" />} />
                      <Route path="analytics" element={<PlaceholderPage title="Analytics" />} />
                    </Route>

                    <Route path="categories" element={<FinanceCategoryManagement />} />
                  </Route>

                  {/* Inventory Department */}
                  <Route path="/inventory" element={<InventoryLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<InventoryDashboard />} />
                    <Route path="raw-material/*" element={<RawMaterial />} />
                    <Route path="production/*" element={<Production />} />
                    <Route path="combos/*" element={<Combos />} />
                    <Route path="combos/create" element={<CreateCombo />} />
                    <Route path="inventory-room" element={<InventoryRoom />} />
                    <Route path="view-barcode/*" element={<ViewBarcode />} />
                    <Route path="quality-check/*" element={<QCBarcodeList />} />
                    <Route path="system" element={<BackupRestore />} />
                  </Route>

                  {/* Customer Tickets Department */}
                  <Route path="/tickets" element={<CustomerTicketsLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<CustomerTicketsDashboard />} />
                    <Route path="open" element={<OpenTickets />} />
                    <Route path="resolved" element={<ResolvedTickets />} />
                    <Route path="new" element={<AddTicket />} />
                    <Route path=":id" element={<TicketDetails />} />
                  </Route>

                  <Route path="/sales" element={<PlaceholderPage title="Sales" icon={<TrendingUp size={32} />} />} />
                  <Route path="/documents" element={<PlaceholderPage title="Document Room" icon={<FolderOpen size={32} />} />} />
                  <Route path="/marketing" element={<MarketingHome />} />
                  <Route path="/tasks" element={<TaskManager />} />
                  <Route path="/research" element={<PlaceholderPage title="Research & Development" icon={<Lightbulb size={32} />} />} />
                  <Route path="/hr" element={<PlaceholderPage title="Human Resources" icon={<Users size={32} />} />} />
                  <Route path="/brand" element={<PlaceholderPage title="Brand Management" icon={<Tag size={32} />} />} />

                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
