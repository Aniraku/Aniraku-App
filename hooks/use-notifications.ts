import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAnirakuAuth } from "@/providers/auth-provider";

export function useNotifications() {
  const { user } = useAnirakuAuth();
  const queryClient = useQueryClient();
  const queryKey = ["notifications", user?.id];
  const notifications = useQuery({ queryKey, enabled: Boolean(user), queryFn: async () => { const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50); if (error) throw error; return data ?? []; } });
  const markRead = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  const markAllRead = useMutation({ mutationFn: async () => { if (!user) return; const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey }) });
  return { notifications, markRead, markAllRead };
}
