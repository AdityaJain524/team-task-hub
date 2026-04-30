import { useQuery } from "@tanstack/react-query";
import { tasksApi, projectsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ListTodo, AlertTriangle, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import CreateTaskDialog from "@/components/CreateTaskDialog";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", isAdmin ? "all" : user?.id],
    queryFn: () => tasksApi.list(isAdmin ? undefined : { assignedTo: user!.id }),
    enabled: !!user,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"], queryFn: projectsApi.list, enabled: !!user,
  });

  const now = new Date();
  const total = tasks.length;
  const pending = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const completed = tasks.filter(t => t.status === "completed").length;
  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== "completed");

  const stats = [
    { label: "Total tasks", value: total, icon: ListTodo, tone: "text-primary" },
    { label: "In progress", value: inProgress, icon: Clock, tone: "text-warning" },
    { label: "Completed", value: completed, icon: CheckCircle2, tone: "text-success" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, tone: "text-destructive" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? "Overview of all team activity." : "Your assigned tasks at a glance."}
          </p>
        </div>
        {isAdmin && <CreateTaskDialog />}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <s.icon className={`w-5 h-5 ${s.tone}`} />
            </div>
            <p className="text-3xl font-bold mt-2 font-mono">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Overdue tasks</h2>
            <Badge variant="destructive">{overdue.length}</Badge>
          </div>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue. 🎉</p>
          ) : (
            <ul className="divide-y">
              {overdue.slice(0, 8).map((t: any) => (
                <li key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.projects?.name} · due {format(new Date(t.deadline), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{t.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Status breakdown</h2>
          </div>
          <div className="space-y-3">
            <StatusRow label="Pending" value={pending} total={total} className="bg-muted-foreground/40" />
            <StatusRow label="In progress" value={inProgress} total={total} className="bg-warning" />
            <StatusRow label="Completed" value={completed} total={total} className="bg-success" />
          </div>
        </Card>
      </div>

      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><FolderKanban className="w-4 h-4" /> Projects</h2>
          <Link to="/projects" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {projects.slice(0, 6).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`}
                className="p-4 rounded-lg border hover:border-primary hover:shadow-card transition-all">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description || "No description"}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusRow({ label, value, total, className }: { label: string; value: number; total: number; className: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{value} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
