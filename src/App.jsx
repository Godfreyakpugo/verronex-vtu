import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Shell from "./components/layout/Shell";
import Dashboard from "./pages/dashboard/Dashboard";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import AuthCallback from "./pages/auth/AuthCallback";
import FundWallet from "./pages/dashboard/FundWallet";
import BuyData from "./pages/dashboard/BuyData";
import BuyAirtime from "./pages/dashboard/BuyAirtime";
import Transactions from "./pages/dashboard/Transactions";
import SettingsPage from "./pages/dashboard/Settings";
import LandingPage from "./pages/public/LandingPage";
import PricelistPage from "./pages/public/PricelistPage";
import "./index.css";

// ✅ OUR NEW DOMAIN-DRIVEN IMPORTS
import WalletManagement from "./pages/admin/wallet/WalletManagement";
import FundingRequests from "./pages/admin/wallet/FundingRequests";
import UserManagement from "./pages/admin/users/UserManagement";
import ProductsDashboard from "./pages/admin/products/ProductsDashboard";
import AdminTransactions from "./pages/admin/transactions/AdminTransactions";
import AdminNotifications from "./pages/admin/notifications/AdminNotifications";
import AccountingPage from "./pages/admin/accounting/AccountingPage";

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_50%),linear-gradient(135deg,#eef2ff_0%,#f5f3ff_30%,#fdf4ff_60%,#ffffff_100%)]">
      <div className="w-6 h-6 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing pages — pricelist is the primary public page */}
        <Route path="/" element={<PricelistPage />} />
        <Route path="/pricelist" element={<PricelistPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Shell>
                <Dashboard />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/fund-wallet"
          element={
            <ProtectedRoute>
              <Shell>
                <FundWallet />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buy-data"
          element={
            <ProtectedRoute>
              <Shell>
                <BuyData />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buy-airtime"
          element={
            <ProtectedRoute>
              <Shell>
                <BuyAirtime />
              </Shell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Shell>
                <Transactions />
              </Shell>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Shell>
                <SettingsPage />
              </Shell>
            </ProtectedRoute>
          }
        />

        {/* ✅ THE MISSING ROUTES: Properly registered now */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/wallet" replace />}
        />

        <Route
          path="/admin/wallet"
          element={
            <AdminRoute>
              <Shell>
                <WalletManagement />
              </Shell>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/funding"
          element={
            <AdminRoute>
              <Shell>
                <FundingRequests />
              </Shell>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <Shell>
                <UserManagement />
              </Shell>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/products"
          element={
            <AdminRoute>
              <Shell>
                <ProductsDashboard />
              </Shell>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/transactions"
          element={
            <AdminRoute>
              <Shell>
                <AdminTransactions />
              </Shell>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/notifications"
          element={
            <AdminRoute>
              <Shell>
                <AdminNotifications />
              </Shell>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/accounting"
          element={
            <AdminRoute>
              <Shell>
                <AccountingPage />
              </Shell>
            </AdminRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
