import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { InvoicesPage } from "@/pages/InvoicesPage";
import { TransactionsPage } from "@/pages/TransactionsPage";
import { ReceiptsPage } from "@/pages/ReceiptsPage";
import { VatOverviewPage } from "@/pages/VatOverviewPage";
import { TasksPage } from "@/pages/TasksPage";
import { SettingsPage } from "@/pages/SettingsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/inloggen" element={<LoginPage />} />
          <Route path="/registreren" element={<RegisterPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="klanten" element={<CustomersPage />} />
            <Route path="facturen" element={<InvoicesPage />} />
            <Route path="transacties" element={<TransactionsPage />} />
            <Route path="bonnetjes" element={<ReceiptsPage />} />
            <Route path="btw" element={<VatOverviewPage />} />
            <Route path="taken" element={<TasksPage />} />
            <Route path="instellingen" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
