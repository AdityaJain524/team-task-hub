import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { projectsApi, tasksApi, membersApi, TaskStatus } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, UserPlus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const taskSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  deadline: z.string().optional(),
  assigned_to: z.string().optional(),
});

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);

  const { data: project } = useQuery({ queryKey: ["project", id], queryFn: () => projectsApi.get(id!), enabled: !!id });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks", "project", id], queryFn: () => tasksApi.list({ projectId: id }), enabled: !!id });
  const { data: members = [] } = useQuery({ queryKey: ["members", id], queryFn: () => membersApi.listForProject(id!), enabled: !!id });
  const { data: allProfiles = [] } = useQuery({ queryKey: ["allProfiles"], queryFn: membersApi.allProfiles, enabled: isAdmin });

  const createTask = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setTaskOpen(false); toast.success("Task created"); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => tasksApi.updateStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteTask = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); },
  });
  const addMember = useMutation({
    mutationFn: ({ userId }: { userId: string }) => membersApi.add(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", id] }); toast.success("Member added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeMember = useMutation({
    mutationFn: membersApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", id] }); toast.success("Member removed"); },
  });

  const onCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = taskSchema.safeParse({
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      deadline: fd.get("deadline") || undefined,
      assigned_to: fd.get("assigned_to") || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    createTask.mutate({
      project_id: id!,
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline).toISOString() : null,
      assigned_to: parsed.data.assigned_to || null,
    });
  };

  const memberUserIds = new Set(members.map((m: any) => m.user_id));
  const availableProfiles = allProfiles.filter((p: any) => !memberUserIds.has(p.id));

  if (!project) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to projects
      </Link>

      <header>
        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-muted-foreground mt-1">{project.description || "No description"}</p>
      </header>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4 mt-6">
          {isAdmin && (
            <div className="flex justify-end">
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" /> New task</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
                  <form onSubmit={onCreateTask} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input id="title" name="title" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="deadline">Deadline</Label>
                        <Input id="deadline" name="deadline" type="datetime-local" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assigned_to">Assignee</Label>
                        <select name="assigned_to" id="assigned_to"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                          <option value="">Unassigned</option>
                          {members.map((m: any) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.profiles?.full_name || m.profiles?.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={createTask.isPending}>
                      {createTask.isPending ? "Creating..." : "Create task"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {tasks.length === 0 ? (
            <Card className="p-10 text-center shadow-card">
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map((t: any) => {
                const overdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== "completed";
                const canUpdate = isAdmin || t.assigned_to === user?.id;
                return (
                  <Card key={t.id} className="p-4 shadow-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{t.title}</h3>
                          <StatusBadge status={t.status} />
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                        </div>
                        {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 font-mono">
                          {t.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {format(new Date(t.deadline), "MMM d, yyyy HH:mm")}
                            </span>
                          )}
                          <span>
                            {t.assignee ? `→ ${t.assignee.full_name || t.assignee.email}` : "Unassigned"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as TaskStatus })}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="text-destructive"
                            onClick={() => { if (confirm("Delete task?")) deleteTask.mutate(t.id); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-4 mt-6">
          {isAdmin && availableProfiles.length > 0 && (
            <Card className="p-4 shadow-card">
              <Label className="mb-2 block">Add member</Label>
              <div className="flex gap-2">
                <select id="add-member-select"
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm">
                  {availableProfiles.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
                <Button onClick={() => {
                  const sel = document.getElementById("add-member-select") as HTMLSelectElement;
                  if (sel?.value) addMember.mutate({ userId: sel.value });
                }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>
            </Card>
          )}

          {members.length === 0 ? (
            <Card className="p-10 text-center shadow-card">
              <p className="text-sm text-muted-foreground">No members yet.</p>
            </Card>
          ) : (
            <Card className="shadow-card divide-y">
              {members.map((m: any) => (
                <div key={m.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.profiles?.full_name || m.profiles?.email}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.profiles?.email}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="text-destructive"
                      onClick={() => { if (confirm("Remove member?")) removeMember.mutate(m.id); }}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "In progress", cls: "bg-warning/15 text-warning-foreground border border-warning/30" },
    completed: { label: "Completed", cls: "bg-success/15 text-success border border-success/30" },
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status].cls}`}>{map[status].label}</span>;
}
