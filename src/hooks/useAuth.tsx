import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi, User, AppRole } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, role: null, loading: true, isAdmin: false,
  login: async () => {}, signup: async () => {}, logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    setLoading(true);
    try {
      const u = await authApi.me();
      setUser(u);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    await authApi.login(email, pass);
    await refreshUser();
  };

  const signup = async (email: string, pass: string, name: string) => {
    await authApi.signup(email, pass, name);
    await refreshUser();
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      role: user?.role ?? null, 
      loading, 
      isAdmin: user?.role === "admin",
      login,
      signup,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
