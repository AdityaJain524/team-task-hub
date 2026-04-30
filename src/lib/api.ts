// REST-style API layer wrapping Supabase. Keeps controllers/routes/models cleanly separated.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// ===== AUTH =====
export const authApi = {
  signup: async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  },
  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  getRole: async (userId: string): Promise<AppRole | null> => {
    const { data, error } = await supabase
      .from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data?.role ?? null;
  },
};

// ===== PROJECTS =====
export const projectsApi = {
  list: async () => {
    const { data, error } = await supabase
      .from("projects").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  get: async (id: string) => {
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },
  create: async (input: { name: string; description?: string }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...input, created_by: u.user.id })
      .select().single();
    if (error) throw error;
    return data;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  },
};

// ===== MEMBERS =====
export const membersApi = {
  listForProject: async (projectId: string) => {
    const { data, error } = await supabase
      .from("project_members")
      .select("id, user_id, added_at, profiles:user_id(id, email, full_name)")
      .eq("project_id", projectId);
    if (error) throw error;
    return data;
  },
  add: async (projectId: string, userId: string) => {
    const { error } = await supabase
      .from("project_members").insert({ project_id: projectId, user_id: userId });
    if (error) throw error;
  },
  remove: async (memberId: string) => {
    const { error } = await supabase.from("project_members").delete().eq("id", memberId);
    if (error) throw error;
  },
  allProfiles: async () => {
    const { data, error } = await supabase
      .from("profiles").select("id, email, full_name").order("full_name");
    if (error) throw error;
    return data;
  },
};

// ===== TASKS =====
export const tasksApi = {
  list: async (filters?: { projectId?: string; assignedTo?: string }) => {
    let q = supabase
      .from("tasks")
      .select("*, projects:project_id(name), assignee:assigned_to(id, full_name, email)")
      .order("created_at", { ascending: false });
    if (filters?.projectId) q = q.eq("project_id", filters.projectId);
    if (filters?.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  create: async (input: {
    project_id: string; title: string; description?: string;
    deadline?: string | null; assigned_to?: string | null;
  }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...input, created_by: u.user.id })
      .select().single();
    if (error) throw error;
    return data;
  },
  updateStatus: async (id: string, status: TaskStatus) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) throw error;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  },
};
