import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

import Register from "@/pages/Register";
import Checkout from "@/pages/Checkout";
import Receipt from "@/pages/Receipt";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import DailyReport from "@/pages/DailyReport";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Register} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/receipt/:orderId" component={Receipt} />
      <Route path="/products" component={Products} />
      <Route path="/orders" component={Orders} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/reports/daily" component={DailyReport} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <CartProvider>
      <Layout>
        <AppRoutes />
      </Layout>
    </CartProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate />
          </WouterRouter>
          <Toaster />
          <PwaUpdatePrompt />
          <PwaInstallPrompt />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
