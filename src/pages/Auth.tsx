import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authApi, AppRole } from "@/lib/api";
import { toast } from "sonner";
import { CheckSquare, Shield, Users } from "lucide-react";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

type Portal = "admin" | "member";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [portal, setPortal] = useState<Portal>("member");

  const portalMeta = {
    admin: {
      label: "Admin",
      icon: Shield,
      tagline: "Manage projects, teams, and tasks.",
      role: "admin" as AppRole,
      accent: "from-primary to-primary-glow",
    },
    member: {
      label: "Team Member",
      icon: Users,
      tagline: "View and update your assigned tasks.",
      role: "member" as AppRole,
      accent: "from-accent to-warning",
    },
  }[portal];

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      fullName: fd.get("fullName"), email: fd.get("email"), password: fd.get("password"),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    try {
      await authApi.signup(parsed.data.email, parsed.data.password, parsed.data.fullName);
      toast.success("Account created. Welcome!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message ?? "Signup failed");
    } finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    try {
      const { user } = await authApi.login(parsed.data.email, parsed.data.password);
      if (!user) throw new Error("Login failed");

      if (user.role !== portalMeta.role) {
        authApi.logout();
        toast.error(
          `This account is registered as ${user.role}. Please use the ${user.role === "admin" ? "Admin" : "Team Member"} portal.`
        );
        return;
      }
      toast.success(`Welcome back, ${portalMeta.label}`);
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    } finally { setLoading(false); }
  };

  const Icon = portalMeta.icon;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${portalMeta.accent} flex items-center justify-center shadow-elegant mb-4 transition-all`}>
            <Icon className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Team Task Manager</h1>
          <p className="text-muted-foreground text-sm mt-1">{portalMeta.tagline}</p>
        </div>

        {/* Portal selector */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary mb-4">
          {(["admin", "member"] as Portal[]).map((p) => {
            const isActive = portal === p;
            const PIcon = p === "admin" ? Shield : Users;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPortal(p)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "bg-card shadow-card text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PIcon className="w-4 h-4" />
                {p === "admin" ? "Admin" : "Team Member"}
              </button>
            );
          })}
        </div>

        <Card className="p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-primary" />
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {portalMeta.label} Portal
            </p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            {portal === "member" && (
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Signing in..." : `Sign in as ${portalMeta.label}`}
                </Button>
                {portal === "admin" && (
                  <p className="text-xs text-muted-foreground text-center">
                    Admin access is restricted to authorized accounts.
                  </p>
                )}
              </form>
            </TabsContent>

            {portal === "member" && (
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" name="fullName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creating..." : "Create account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    New accounts are created as <strong>Team Members</strong>. Administrator privileges can only be granted by an existing Admin.
                  </p>
                </form>
              </TabsContent>
            )}
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
