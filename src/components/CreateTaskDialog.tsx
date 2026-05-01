import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { projectsApi, tasksApi, membersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Lock } from "lucide-react";
import { toast } from "sonner";

const taskSchema = z.object({
  project_id: z.string().uuid("Select a project"),
  title: z.string().trim().min(2, "Title too short").max(120),
  description: z.string().trim().max(1000).optional(),
  deadline: z.string().optional(),
  assigned_to: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
});

interface Props {
  defaultProjectId?: string;
  trigger?: React.ReactNode;
  /** lock project selection (used inside ProjectDetail) */
  lockProject?: boolean;
}

export default function CreateTaskDialog({ defaultProjectId, trigger, lockProject }: Props) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "");

  useEffect(() => { if (defaultProjectId) setProjectId(defaultProjectId); }, [defaultProjectId]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"], queryFn: projectsApi.list, enabled: open && isAdmin,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => membersApi.listForProject(projectId),
    enabled: open && !!projectId,
  });

  const createTask = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      toast.success("Task created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = taskSchema.safeParse({
      project_id: projectId,
      title: fd.get("title"),
      description: fd.get("description") || undefined,
      deadline: fd.get("deadline") || undefined,
      assigned_to: fd.get("assigned_to") || undefined,
      priority: fd.get("priority") || "medium",
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    createTask.mutate({
      projectId: parsed.data.project_id,
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline).toISOString() : null,
      assignedTo: parsed.data.assigned_to || null,
      // @ts-ignore - added priority to api
      priority: parsed.data.priority,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button><Plus className="w-4 h-4 mr-2" /> New task</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Create task</DialogTitle>
          <DialogDescription>Only admins can create and assign tasks.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project_id">Project</Label>
            <select
              id="project_id"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={lockProject}
              required
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-60"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-1">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Task title" />
            </div>
            <div className="space-y-2 col-span-1">
              <Label htmlFor="priority">Priority</Label>
              <select
                name="priority" id="priority" defaultValue="medium"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
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
              <select
                name="assigned_to" id="assigned_to"
                disabled={!projectId}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-60"
              >
                <option value="">Unassigned</option>
                {members.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {projectId && members.length === 0 && (
            <p className="text-xs text-warning">No members in this project yet — task will be unassigned.</p>
          )}

          <Button type="submit" className="w-full" disabled={createTask.isPending || !projectId}>
            {createTask.isPending ? "Creating..." : "Create task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
