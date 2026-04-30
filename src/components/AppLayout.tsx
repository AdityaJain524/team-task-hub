import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authApi } from "@/lib/api";
import { CheckSquare, LayoutDashboard, FolderKanban, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, role, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); navigate("/auth"); }
    catch (e: any) { toast.error(e.message); }
  };

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r bg-sidebar flex flex-col">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 border-b">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">TeamTasks</span>
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/" end className={navCls}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>
          <NavLink to="/projects" className={navCls}>
            <FolderKanban className="w-4 h-4" /> Projects
          </NavLink>
        </nav>
        <div className="p-3 border-t space-y-3">
          <div className="px-2">
            <p className="text-xs font-medium truncate">{user?.email}</p>
            <Badge variant={isAdmin ? "default" : "secondary"} className="mt-1 text-[10px]">
              {role ?? "loading..."}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
