"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { AdminUser } from "@/types";

interface AdminAuthContextValue {
  session: Session | null;
  admin: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) checkAdmin(data.session);
      else setLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) { (async () => { await checkAdmin(sess); })(); }
      else { setAdmin(null); setLoading(false); }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  async function checkAdmin(sess: Session) {
    try {
      const { data, error } = await supabase.from("admins").select("*").eq("id", sess.user.id).maybeSingle();
      setAdmin(error || !data ? null : (data as AdminUser));
    } catch { setAdmin(null); }
    finally { setLoading(false); }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signOut = async () => { await supabase.auth.signOut(); setAdmin(null); };

  return (
    <AdminAuthContext.Provider value={{ session, admin, loading, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
