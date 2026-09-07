import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (!mountedRef.current) return;
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      const sessionToken = await Auth.getSessionToken();
      if (!mountedRef.current) return;
      if (!sessionToken) {
        setUser(null);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      if (!mountedRef.current) return;
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      setError(error);
      setUser(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      if (mountedRef.current) {
        setUser(null);
        setError(null);
      }
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    mountedRef.current = true;
    if (autoFetch) {
      if (Platform.OS === "web") {
        fetchUser();
      } else {
        Auth.getUserInfo().then((cachedUser) => {
          if (!mountedRef.current) return;
          if (cachedUser) {
            setUser(cachedUser);
            setLoading(false);
          } else {
            fetchUser();
          }
        });
      }
    } else {
      setLoading(false);
    }
    return () => { mountedRef.current = false; };
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
