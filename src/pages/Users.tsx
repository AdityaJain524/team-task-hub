import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membersApi, AppRole } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, User, Mail, Calendar, UserPlus, Filter, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { z } from "zod";

const newUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "member"]),
});

export default function Users() {
  const { isAdmin, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: membersApi.allProfiles,
    enabled: isAdmin,
  });

  const createUser = useMutation({
    mutationFn: membersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allUsers"] });
      setOpen(false);
      toast.success("User created successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => membersApi.updateRole(userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allUsers"] });
      toast.success("Role updated successfully");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = newUserSchema.safeParse({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      password: fd.get("password"),
      role: fd.get("role"),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    createUser.mutate(parsed.data);
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Unauthorized</div>;

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground mt-1">Manage team roles, access, and permissions.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-elegant"><UserPlus className="w-4 h-4 mr-2" /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" placeholder="e.g. Jane Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="jane@company.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
                <p className="text-[10px] text-muted-foreground italic">Must be at least 8 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" defaultValue="member">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Team Member</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create User"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/30 p-3 rounded-lg border border-dashed">
        <Filter className="w-3.5 h-3.5" />
        Displaying {users.length} registered accounts
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-secondary/20 animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {users.map((u: any) => (
            <Card key={u.id} className="p-5 shadow-card hover:shadow-elegant transition-all border-l-4 border-l-transparent hover:border-l-primary group">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                    {u.role === 'admin' ? <Shield className="w-6 h-6" /> : <User className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg group-hover:text-primary transition-colors">{u.full_name}</p>
                      {u.id === currentUser?.id && <Badge variant="outline" className="text-[10px] h-5">You</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {u.email}</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Joined {format(new Date(u.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Current Role</p>
                    <Badge className="capitalize px-3" variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role}
                    </Badge>
                  </div>
                  
                  {u.id !== currentUser?.id && (
                    <div className="flex items-center gap-2 ml-4">
                      <Select
                        value={u.role}
                        onValueChange={(val) => {
                          if (confirm(`Change ${u.full_name}'s role to ${val}?`)) {
                            updateRole.mutate({ userId: u.id, role: val as AppRole });
                          }
                        }}
                      >
                        <SelectTrigger className="w-32 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
