"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { upsertCustomerProfile } from "@/lib/customer-profile-sync";
import { supabase } from "@/lib/supabase";

type CustomerAuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) void upsertCustomerProfile(data.session.user);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) void upsertCustomerProfile(nextSession.user);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo<CustomerAuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    refresh,
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
    },
  }), [loading, refresh, session]);

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return context;
}
