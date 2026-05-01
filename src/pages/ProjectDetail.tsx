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
import { ArrowLeft, Plus, Trash2, UserPlus, Calendar, User } from "lucide-react";
import CreateTaskDialog from "@/components/CreateTaskDialog";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);

  const { data: project } = useQuery({ queryKey: ["project", id], queryFn: () => projectsApi.get(id!), enabled: !!id });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks", "project", id], queryFn: () => tasksApi.listForProject(id!), enabled: !!id });
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
    mutationFn: (userId: string) => membersApi.remove(id!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", id] }); toast.success("Member removed"); },
  });

  const memberUserIds = new Set(members.map((m: any) => m.id));
  const availableProfiles = allProfiles.filter((p: any) => !memberUserIds.has(p.id) && p.role === 'member');

  if (!project) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 pb-12">
      <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to projects
      </Link>

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="font-mono text-[10px]">Project</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl">{project.description || "No description provided."}</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <CreateTaskDialog defaultProjectId={id} lockProject trigger={<Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Task</Button>} />
          </div>
        )}
      </header>

      <Tabs defaultValue="tasks" className="w-full">
        <div className="border-b mb-6">
          <TabsList className="bg-transparent h-auto p-0 gap-6">
            <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-base font-semibold">
              Tasks <Badge variant="secondary" className="ml-2 text-[10px] h-5">{tasks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 text-base font-semibold">
              Members <Badge variant="secondary" className="ml-2 text-[10px] h-5">{members.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="space-y-4 mt-0">
          {tasks.length === 0 ? (
            <Card className="p-12 text-center shadow-card border-dashed">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold">No tasks assigned yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isAdmin ? "Start by creating a new task for this project." : "You don't have any tasks in this project."}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {tasks.map((t: any) => {
                const overdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== "done";
                const canUpdate = isAdmin || t.assigned_to === user?.id;
                return (
                  <Card key={t.id} className="p-5 shadow-card hover:shadow-elegant transition-all group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <PriorityBadge priority={t.priority} />
                          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{t.title}</h3>
                          <StatusBadge status={t.status} />
                          {overdue && <Badge variant="destructive" className="animate-pulse">Overdue</Badge>}
                        </div>
                        {t.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{t.description}</p>}
                        <div className="flex items-center gap-5 text-xs text-muted-foreground mt-4 font-medium">
                          {t.deadline && (
                            <span className={`flex items-center gap-1.5 ${overdue ? 'text-destructive' : ''}`}>
                              <Calendar className="w-3.5 h-3.5" /> {format(new Date(t.deadline), "MMM d, yyyy HH:mm")}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {t.assignee_name ? t.assignee_name : <span className="italic text-muted-foreground/60">Unassigned</span>}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canUpdate && (
                          <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as TaskStatus })}>
                            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
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

        <TabsContent value="members" className="space-y-6 mt-0">
          {isAdmin && (
            <Card className="p-5 shadow-card border-primary/20 bg-primary/5">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-xs uppercase tracking-wider font-bold text-primary mb-2 block">Add Project Member</Label>
                  <select id="add-member-select"
                    disabled={availableProfiles.length === 0}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none">
                    {availableProfiles.length === 0 ? (
                      <option>All available members are already in the project</option>
                    ) : (
                      <>
                        <option value="">Select a teammate...</option>
                        {availableProfiles.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <Button 
                  className="mt-6"
                  disabled={availableProfiles.length === 0}
                  onClick={() => {
                  const sel = document.getElementById("add-member-select") as HTMLSelectElement;
                  if (sel?.value) addMember.mutate({ userId: sel.value });
                }}>
                  <UserPlus className="w-4 h-4 mr-2" /> Assign Member
                </Button>
              </div>
            </Card>
          )}

          {members.length === 0 ? (
            <Card className="p-12 text-center shadow-card border-dashed">
              <User className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold">No team members assigned</h3>
              <p className="text-sm text-muted-foreground mt-1">Members added here will be able to view and contribute to tasks.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {members.map((m: any) => (
                <Card key={m.id} className="p-4 shadow-card hover:shadow-elegant transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold">{m.full_name || m.email}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.email}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm("Remove member from project?")) removeMember.mutate(m.id); }}>
                        Remove
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const map: Record<TaskStatus, { label: string; cls: string }> = {
    todo: { label: "To Do", cls: "bg-muted text-muted-foreground" },
    in_progress: { label: "In progress", cls: "bg-warning/15 text-warning-foreground border border-warning/30" },
    done: { label: "Done", cls: "bg-success/15 text-success border border-success/30" },
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status].cls}`}>{map[status].label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    low: { label: "Low", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    medium: { label: "Medium", cls: "bg-orange-100 text-orange-700 border-orange-200" },
    high: { label: "High", cls: "bg-red-100 text-red-700 border-red-200" },
  };
  const config = map[priority] || map.medium;
  return <span className={`text-[10px] px-1.5 py-0 border rounded uppercase font-bold tracking-tight ${config.cls}`}>{config.label}</span>;
}
