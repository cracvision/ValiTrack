import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGuard } from "@/components/RoleGuard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import SystemProfiles from "./pages/SystemProfiles";
import ReviewCases from "./pages/ReviewCases";
import ReviewCaseDetail from "./pages/ReviewCaseDetail";
import EvidenceVault from "./pages/EvidenceVault";
import FindingsActions from "./pages/FindingsActions";
import Reports from "./pages/Reports";
import AuditLog from "./pages/AuditLog";
import UserManagement from "./pages/UserManagement";
import IntrayPage from "./pages/IntrayPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes inside Layout */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/intray" element={<IntrayPage />} />
                    <Route path="/systems" element={<SystemProfiles />} />
                    <Route path="/reviews" element={<ReviewCases />} />
                    <Route path="/reviews/:id" element={<ReviewCaseDetail />} />
                    <Route path="/evidence" element={<EvidenceVault />} />
                    <Route path="/findings" element={<FindingsActions />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/audit-log" element={<AuditLog />} />
                    <Route
                      path="/admin/users"
                      element={
                        <RoleGuard requiredRoles={['super_user']}>
                          <UserManagement />
                        </RoleGuard>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
