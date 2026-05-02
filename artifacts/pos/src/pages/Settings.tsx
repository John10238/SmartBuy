import { useEffect, useState, type FormEvent } from "react";
import {
  useGetSettings,
  useUpdateSettings,
  useUpdateCredentials,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ImageUp, Trash2, UserPlus, KeyRound, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { BrandMark } from "@/components/BrandMark";

interface StaffUser {
  id: number;
  username: string;
  createdAt: string;
}

function useStaffUsers() {
  return useQuery<StaffUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      return res.json() as Promise<StaffUser[]>;
    },
  });
}

function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to create user");
      return json as StaffUser;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
  });
}

function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to delete user");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/users"] }),
  });
}

function useResetPassword() {
  return useMutation({
    mutationFn: async (data: { id: number; newPassword: string }) => {
      const res = await fetch(`/api/users/${data.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to reset password");
      return json;
    },
  });
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();

  const settings = useGetSettings({
    query: {
      queryKey: getGetSettingsQueryKey(),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  });
  const updateSettings = useUpdateSettings();

  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setBusinessName(settings.data.businessName);
      setLogoUrl(settings.data.logoUrl ?? null);
    }
  }, [settings.data]);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      setLogoUrl(response.objectPath);
      try {
        await updateSettings.mutateAsync({ data: { logoUrl: response.objectPath } });
        await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Logo updated" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Save failed";
        toast({ title: "Couldn't save logo", description: message, variant: "destructive" });
      }
    },
    onError: (err) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  async function onSaveBusiness(e: FormEvent) {
    e.preventDefault();
    const trimmed = businessName.trim();
    if (!trimmed) return;
    try {
      await updateSettings.mutateAsync({ data: { businessName: trimmed } });
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Business name saved" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    }
  }

  async function onRemoveLogo() {
    setLogoUrl(null);
    try {
      await updateSettings.mutateAsync({ data: { logoUrl: null } });
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: "Logo removed" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your business identity, staff accounts and your own credentials.
        </p>
      </div>

      {/* Business identity */}
      <Card>
        <CardHeader>
          <CardTitle>Business identity</CardTitle>
          <CardDescription>
            This name and logo appear in the sidebar, on the login screen and on receipts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <BrandMark businessName={businessName || "Business"} logoUrl={logoUrl} size="xl" />
            <div className="space-y-2">
              <input
                id="logo-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast({ title: "File too large", description: "Pick an image under 5 MB.", variant: "destructive" });
                    return;
                  }
                  void uploadFile(file);
                }}
              />
              <Button type="button" variant="outline" disabled={isUploading} onClick={() => document.getElementById("logo-input")?.click()}>
                <ImageUp className="w-4 h-4 mr-2" />
                {isUploading ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {logoUrl && (
                <Button type="button" variant="ghost" className="text-destructive" onClick={onRemoveLogo} disabled={updateSettings.isPending}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">JPG, PNG or WebP. Square images look best.</p>
            </div>
          </div>
          <Separator />
          <form onSubmit={onSaveBusiness} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="My Shop"
                required
              />
            </div>
            <Button type="submit" disabled={updateSettings.isPending || !businessName.trim() || businessName.trim() === settings.data?.businessName}>
              Save business name
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Staff accounts */}
      <StaffAccountsCard currentUserId={user?.id} />

      {/* Own credentials */}
      <Card>
        <CardHeader>
          <CardTitle>My credentials</CardTitle>
          <CardDescription>
            Signed in as <span className="font-medium">{user?.username}</span>. Changes only affect your own account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialsForm onUpdated={refresh} />
        </CardContent>
      </Card>
    </div>
  );
}

function StaffAccountsCard({ currentUserId }: { currentUserId?: number }) {
  const { toast } = useToast();
  const { data: users, isLoading } = useStaffUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");

  async function onCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;
    try {
      await createUser.mutateAsync({ username: newUsername.trim(), password: newPassword });
      setNewUsername("");
      setNewPassword("");
      toast({ title: "Account created", description: `${newUsername.trim()} can now log in.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      toast({ title: "Failed", description: message, variant: "destructive" });
    }
  }

  async function onDeleteUser(id: number, username: string) {
    try {
      await deleteUser.mutateAsync(id);
      toast({ title: "Account removed", description: `${username} has been deleted.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast({ title: "Failed", description: message, variant: "destructive" });
    }
  }

  async function onResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTargetId || !resetNewPassword) return;
    if (resetNewPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: resetTargetId, newPassword: resetNewPassword });
      setResetTargetId(null);
      setResetNewPassword("");
      toast({ title: "Password reset", description: "The new password is now active." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset";
      toast({ title: "Failed", description: message, variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff accounts</CardTitle>
        <CardDescription>
          Give each staff member their own account so password changes only affect that person.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Existing users */}
        <div className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {users?.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{u.username}</span>
                  {u.id === currentUserId && (
                    <Badge variant="secondary" className="text-xs">You</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(u.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Reset password dialog */}
                <AlertDialog open={resetTargetId === u.id} onOpenChange={(open) => { if (!open) { setResetTargetId(null); setResetNewPassword(""); } }}>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setResetTargetId(u.id)}>
                      <KeyRound className="w-3.5 h-3.5" />
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset password for {u.username}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Set a new password for this account. The user will need to use this new password to log in.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <form id="reset-pw-form" onSubmit={onResetPassword}>
                      <div className="space-y-2 py-2">
                        <Label htmlFor="resetNewPassword">New password</Label>
                        <Input
                          id="resetNewPassword"
                          type="password"
                          placeholder="At least 6 characters"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          required
                          minLength={6}
                          autoFocus
                        />
                      </div>
                    </form>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        type="submit"
                        form="reset-pw-form"
                        disabled={resetPassword.isPending || resetNewPassword.length < 6}
                      >
                        {resetPassword.isPending ? "Saving..." : "Set password"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete — disabled for own account */}
                {u.id !== currentUserId && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {u.username}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete their account. They won't be able to log in anymore.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => void onDeleteUser(u.id, u.username)}
                          disabled={deleteUser.isPending}
                        >
                          Remove account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Create new user */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add staff account
          </h3>
          <form onSubmit={onCreateUser} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="newStaffUsername">Username</Label>
                <Input
                  id="newStaffUsername"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. jane"
                  minLength={3}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newStaffPassword">Password</Label>
                <Input
                  id="newStaffPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={createUser.isPending} className="gap-2">
              <UserPlus className="w-4 h-4" />
              {createUser.isPending ? "Creating..." : "Create account"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function CredentialsForm({ onUpdated }: { onUpdated: () => Promise<void> }) {
  const { toast } = useToast();
  const updateCredentials = useUpdateCredentials();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) return;

    if (newPassword && newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (!newUsername && !newPassword) {
      toast({ title: "Nothing to change", description: "Enter a new username or new password.", variant: "destructive" });
      return;
    }

    try {
      await updateCredentials.mutateAsync({
        data: {
          currentPassword,
          ...(newUsername ? { newUsername: newUsername.trim() } : {}),
          ...(newPassword ? { newPassword } : {}),
        },
      });
      await onUpdated();
      setCurrentPassword("");
      setNewUsername("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Credentials updated" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update credentials";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="newUsername">New username (optional)</Label>
        <Input
          id="newUsername"
          autoComplete="username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          placeholder="At least 3 characters"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password (optional)</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat new password"
          />
        </div>
      </div>
      <Button type="submit" disabled={updateCredentials.isPending}>
        {updateCredentials.isPending ? "Saving..." : "Update my credentials"}
      </Button>
    </form>
  );
}
