import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ReceiptText,
  Settings as SettingsIcon,
  LogOut,
  FileBarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetSettings,
  useLogout,
  getGetCurrentUserQueryKey,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/contexts/AuthContext";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, clear } = useAuth();
  const settings = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey(),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });
  const logout = useLogout();

  const businessName = settings.data?.businessName ?? "Duka POS";
  const logoUrl = settings.data?.logoUrl ?? null;

  const navItems = [
    { href: "/", label: "Register", icon: ShoppingCart },
    { href: "/products", label: "Products", icon: Package },
    { href: "/orders", label: "Orders", icon: ReceiptText },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/reports/daily", label: "Reports", icon: FileBarChart2 },
    { href: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  async function onLogout() {
    try {
      await logout.mutateAsync();
      clear();
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Logout failed";
      toast({
        title: "Logout failed",
        description: message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <BrandMark businessName={businessName} logoUrl={logoUrl} size="md" />
          <h1 className="font-bold text-lg tracking-tight text-sidebar-foreground truncate">
            {businessName}
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border space-y-2">
          {user ? (
            <p className="text-xs text-muted-foreground px-2">
              Signed in as <span className="font-medium">{user.username}</span>
            </p>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onLogout}
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {logout.isPending ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border bg-card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <BrandMark
              businessName={businessName}
              logoUrl={logoUrl}
              size="sm"
            />
            <h1 className="font-bold text-base truncate">{businessName}</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            disabled={logout.isPending}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </header>

        {/* Mobile Nav - Bottom */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card pb-safe z-50">
          <div className="flex justify-around p-2">
            {navItems.map((item) => {
              const isActive =
                location === item.href ||
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center p-2 rounded-lg gap-1 min-w-12",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Page Content */}
        <div className="flex-1 overflow-auto md:pb-0 pb-16">{children}</div>
      </main>
    </div>
  );
}
