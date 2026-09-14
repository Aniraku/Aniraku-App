import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAnirakuAuth } from "@/providers/auth-provider";
import { useProviderSync } from "@/hooks/use-provider-sync";
import {
  FIRST_RUN_IMPORT_STORAGE_KEY,
  parseFirstRunImportPrompted,
  shouldPromptFirstRunImport,
} from "@/lib/first-run-import";

export function useFirstRunImport() {
  const { user, verified } = useAnirakuAuth();
  const sync = useProviderSync();
  const [hasPrompted, setHasPrompted] = useState(true);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(FIRST_RUN_IMPORT_STORAGE_KEY)
      .then((raw) => {
        if (active) setHasPrompted(parseFirstRunImportPrompted(raw));
      })
      .catch(() => {
        if (active) setHasPrompted(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setHasPrompted(true);
    void AsyncStorage.setItem(FIRST_RUN_IMPORT_STORAGE_KEY, JSON.stringify({ prompted: true })).catch(
      () => {},
    );
  }, []);

  const runImport = useCallback(async () => {
    const provider = sync.connected[0];
    if (!provider) throw new Error("Connect a provider first.");
    const result = await sync.importLibrary.mutateAsync(provider);
    dismiss();
    return result;
  }, [dismiss, sync.connected, sync.importLibrary]);

  const shouldPrompt = shouldPromptFirstRunImport({
    signedIn: Boolean(user),
    verified,
    connectedProviders: sync.connected,
    hasPrompted,
  });

  return {
    shouldPrompt,
    provider: sync.connected[0] ?? null,
    importing: sync.importLibrary.isPending,
    importError: sync.importLibrary.error,
    dismiss,
    runImport,
  };
}
