import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppRole } from "@/lib/api";

export default function RoleGuard({
  children,
  allow,
  fallback = "/",
}: {
  children: ReactNode;
  allow: AppRole[];
  fallback?: string;
}) {
  const { role, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!role || !allow.includes(role)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
