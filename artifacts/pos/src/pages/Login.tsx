import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import {
  useLogin,
  useGetSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const settings = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey(),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });
  const login = useLogin();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const businessName = settings.data?.businessName ?? "SmartBuy";
  const logoUrl = settings.data?.logoUrl ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      await login.mutateAsync({
        data: { username: username.trim(), password },
      });
      await refresh();
      navigate("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid username or password";
      toast({
        title: "Couldn't sign you in",
        description: message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <BrandBadge businessName={businessName} logoUrl={logoUrl} large />
            <h1 className="mt-3 text-xl font-bold">{businessName}</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your point of sale
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            First time? Use <span className="font-medium">admin</span> /{" "}
            <span className="font-medium">admin</span>, then change it from
            Settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function BrandBadge({
  businessName,
  logoUrl,
  large = false,
}: {
  businessName: string;
  logoUrl: string | null;
  large?: boolean;
}) {
  const size = large ? "w-16 h-16" : "w-10 h-10";
  const resolved = resolveLogoSrc(logoUrl);
  return (
    <div
      className={`${size} rounded-full border-2 border-primary/30 bg-primary/10 overflow-hidden flex items-center justify-center`}
    >
      {resolved ? (
        <img
          src={resolved}
          alt={businessName}
          className="w-full h-full object-cover"
        />
      ) : (
        <Store className={large ? "w-7 h-7 text-primary" : "w-5 h-5 text-primary"} />
      )}
    </div>
  );
}

function resolveLogoSrc(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/objects/")) return `/api/storage${value}`;
  return value;
}
