import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Principal } from "@dfinity/principal";
import {
  BarChart2,
  Check,
  Copy,
  CreditCard,
  LogIn,
  LogOut,
  Settings,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { UserRole } from "../backend";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import {
  useAssignUserRole,
  useGetCallerUserProfile,
  useIsStripeConfigured,
  useListJobs,
  useSetStripeConfiguration,
} from "../hooks/useQueries";

const OWNER_PRINCIPAL =
  "asn62-s2yb6-ezdxu-wy6eu-ml2sx-yaqyb-tvmkf-bgefi-2iqtw-a7b53-yqe";

export default function SettingsPage() {
  const {
    identity,
    login,
    clear: logout,
    isInitializing,
  } = useInternetIdentity();
  const isLoggedIn = !!identity;
  const isOwner = identity?.getPrincipal().toString() === OWNER_PRINCIPAL;
  const principalStr = identity?.getPrincipal().toString() ?? "";

  const { data: userProfile } = useGetCallerUserProfile();
  const { data: jobs = [] } = useListJobs();
  const { data: stripeConfigured } = useIsStripeConfigured();

  const setStripeConfig = useSetStripeConfiguration();
  const assignRole = useAssignUserRole();

  // Stripe form
  const [stripeKey, setStripeKey] = useState("");
  const [stripeError, setStripeError] = useState("");
  const [stripeSaved, setStripeSaved] = useState(false);

  // Access management
  const [newPrincipal, setNewPrincipal] = useState("");
  const [grantedUsers, setGrantedUsers] = useState<string[]>([]);
  const [userError, setUserError] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  // Copy principal
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(principalStr);
    setCopied(true);
    toast.success("Principal ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Analytics: income by tech
  const techIncome: Record<string, number> = {};
  let totalIncome = 0;
  for (const job of jobs) {
    const tech = job.tech.toString();
    const jobTotal = job.laborLineItems.reduce(
      (sum, item) => sum + Number(item.totalAmount),
      0,
    );
    techIncome[tech] = (techIncome[tech] ?? 0) + jobTotal;
    totalIncome += jobTotal;
  }

  const handleSaveStripe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeKey) {
      setStripeError("Stripe secret key is required");
      return;
    }
    setStripeError("");
    try {
      await setStripeConfig.mutateAsync({
        secretKey: stripeKey,
        allowedCountries: ["US"],
      });
      setStripeSaved(true);
      setStripeKey("");
      setTimeout(() => setStripeSaved(false), 3000);
    } catch (e: unknown) {
      setStripeError(
        e instanceof Error ? e.message : "Failed to save Stripe configuration",
      );
    }
  };

  const handleAddUser = async () => {
    if (!newPrincipal.trim()) {
      setUserError("Please enter a principal ID");
      return;
    }
    setUserError("");
    setAddingUser(true);
    try {
      const user = Principal.fromText(newPrincipal.trim());
      await assignRole.mutateAsync({ user, role: UserRole.user });
      setGrantedUsers((prev) => [...prev, newPrincipal.trim()]);
      setNewPrincipal("");
      toast.success("User granted access");
    } catch (e: unknown) {
      setUserError(
        e instanceof Error
          ? e.message
          : "Failed to add user. Make sure the principal ID is valid.",
      );
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (principalId: string) => {
    try {
      const user = Principal.fromText(principalId);
      await assignRole.mutateAsync({ user, role: UserRole.guest });
      setGrantedUsers((prev) => prev.filter((p) => p !== principalId));
      toast.success("User access revoked");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove user");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Settings
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1: Login / Logout */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {isLoggedIn ? (
                <LogOut className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Login Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isInitializing ? (
              <p className="text-sm text-muted-foreground">
                Checking login status…
              </p>
            ) : isLoggedIn ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">
                      {userProfile?.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {userProfile?.name ?? "Logged In"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOwner ? "Owner" : "Authorized User"}
                    </p>
                  </div>
                  {isOwner && (
                    <Badge className="bg-primary shrink-0">Owner</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => logout()}
                  data-ocid="settings.secondary_button"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Log in with Internet Identity to access the service desk.
                </p>
                <Button
                  className="w-full"
                  onClick={() => login()}
                  data-ocid="settings.primary_button"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Principal ID */}
        {isLoggedIn && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Your Principal ID
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Copy and share your Principal ID with the app owner to be
                granted authorized user access.
              </p>
              <div className="flex items-start gap-2">
                <div
                  className="flex-1 bg-muted rounded-lg px-3 py-2 font-mono text-xs break-all select-all leading-relaxed"
                  data-ocid="settings.panel"
                >
                  {principalStr}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                  data-ocid="settings.secondary_button"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Analytics — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Analytics — Income by Technician
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(techIncome).length === 0 ? (
                <p
                  className="text-sm text-muted-foreground text-center py-2"
                  data-ocid="settings.empty_state"
                >
                  No income data yet. Jobs with labor items will appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(techIncome).map(([tech, income], idx) => (
                    <div
                      key={tech}
                      data-ocid={`settings.item.${idx + 1}`}
                      className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {tech.slice(0, 12)}…
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Technician
                        </p>
                      </div>
                      <span className="font-semibold text-sm text-primary">
                        ${(income / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between px-3 py-1">
                    <span className="text-sm font-medium">Total Income</span>
                    <span className="font-bold text-primary">
                      ${(totalIncome / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Section 4: Grant Access — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Grant User Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  To grant a technician access: ask them to log in and copy
                  their Principal ID from this Settings screen, then paste it
                  below.
                </p>
              </div>

              {userError && (
                <p
                  className="text-xs text-destructive"
                  data-ocid="settings.error_state"
                >
                  {userError}
                </p>
              )}

              {grantedUsers.length > 0 && (
                <div className="space-y-2">
                  {grantedUsers.map((p, idx) => (
                    <div
                      key={p}
                      data-ocid={`settings.item.${idx + 1}`}
                      className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2"
                    >
                      <p className="text-xs font-mono truncate flex-1 mr-2">
                        {p}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(p)}
                        data-ocid={`settings.delete_button.${idx + 1}`}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="principal-input">Principal ID</Label>
                <Input
                  id="principal-input"
                  placeholder="Paste technician Principal ID here…"
                  value={newPrincipal}
                  onChange={(e) => setNewPrincipal(e.target.value)}
                  className="font-mono text-xs"
                  data-ocid="settings.input"
                />
                <Button
                  onClick={handleAddUser}
                  disabled={addingUser || !newPrincipal.trim()}
                  className="w-full"
                  size="sm"
                  data-ocid="settings.primary_button"
                >
                  {addingUser ? (
                    <span className="animate-spin mr-1">⏳</span>
                  ) : (
                    <UserPlus className="h-4 w-4 mr-1" />
                  )}
                  Grant Access
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Stripe Configuration — owner only */}
        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                <Badge
                  variant={stripeConfigured ? "default" : "outline"}
                  className={stripeConfigured ? "bg-green-600 text-white" : ""}
                >
                  {stripeConfigured ? "Configured" : "Not Configured"}
                </Badge>
              </div>
              <form onSubmit={handleSaveStripe} className="space-y-3">
                {stripeError && (
                  <p className="text-xs text-destructive">{stripeError}</p>
                )}
                <div>
                  <Label>Stripe Secret Key</Label>
                  <Input
                    className="mt-1"
                    type="password"
                    placeholder="sk_live_... or sk_test_..."
                    value={stripeKey}
                    onChange={(e) => setStripeKey(e.target.value)}
                    data-ocid="settings.input"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  disabled={setStripeConfig.isPending}
                  data-ocid="settings.submit_button"
                >
                  {stripeSaved
                    ? "✓ Saved!"
                    : stripeConfigured
                      ? "Update Stripe Key"
                      : "Save Stripe Key"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>© {new Date().getFullYear()} Reliable Home Appliance Repair LLC</p>
          <p className="mt-1">
            Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai/?utm_source=Caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
