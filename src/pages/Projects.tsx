import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { projectsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FolderKanban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Name too short").max(100),
  description: z.string().trim().max(500).optional(),
});

export default function Projects() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  const createMut = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setOpen(false); toast.success("Project created"); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: projectsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Project deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = projectSchema.safeParse({ name: fd.get("name"), description: fd.get("description") || undefined });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    createMut.mutate(parsed.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">{projects.length} project{projects.length !== 1 && "s"}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  {createMut.isPending ? "Creating..." : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center shadow-card">
          <FolderKanban className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Create your first project to get started." : "Ask an admin to add you to a project."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <Card key={p.id} className="p-5 shadow-card hover:shadow-elegant transition-all group">
              <Link to={`/projects/${p.id}`} className="block">
                <h3 className="font-semibold group-hover:text-primary transition-colors">{p.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">
                  {p.description || "No description"}
                </p>
                <p className="text-xs text-muted-foreground mt-3 font-mono">
                  Created {format(new Date(p.created_at), "MMM d, yyyy")}
                </p>
              </Link>
              {isAdmin && (
                <Button variant="ghost" size="sm" className="mt-3 text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
