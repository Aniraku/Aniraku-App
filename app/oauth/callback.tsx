import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    sessionToken?: string;
    user?: string;
  }>();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const redirectTimer = setTimeout(() => router.replace("/(tabs)"), 1000);
    const handleCallback = async () => {
      try {
        if (params.sessionToken) {
          await Auth.setSessionToken(params.sessionToken);
          if (params.user) {
            try {
              const userJson =
                typeof atob !== "undefined"
                  ? atob(params.user)
                  : Buffer.from(params.user, "base64").toString("utf-8");
              const userData = JSON.parse(userJson);
              const userInfo: Auth.User = {
                id: userData.id,
                openId: userData.openId,
                name: userData.name,
                email: userData.email,
                loginMethod: userData.loginMethod,
                lastSignedIn: new Date(userData.lastSignedIn || Date.now()),
              };
              await Auth.setUserInfo(userInfo);
            } catch {
              // silently ignore
            }
          }
          setStatus("success");
          return;
        }

        let url: string | null = null;

        if (params.code || params.state || params.error) {
          const urlParams = new URLSearchParams();
          if (params.code) urlParams.set("code", params.code);
          if (params.state) urlParams.set("state", params.state);
          if (params.error) urlParams.set("error", params.error);
          url = `?${urlParams.toString()}`;
        } else {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) url = initialUrl;
        }

        const error =
          params.error || (url ? new URL(url, "http://dummy").searchParams.get("error") : null);
        if (error) {
          setStatus("error");
          setErrorMessage(error || "OAuth error occurred");
          return;
        }

        let code: string | null = null;
        let state: string | null = null;
        let sessionToken: string | null = null;

        if (params.code && params.state) {
          code = params.code;
          state = params.state;
        } else if (url) {
          try {
            const urlObj = new URL(url);
            code = urlObj.searchParams.get("code");
            state = urlObj.searchParams.get("state");
            sessionToken = urlObj.searchParams.get("sessionToken");
          } catch {
            const match = url.match(/[?&](code|state|sessionToken)=([^&]+)/g);
            if (match) {
              match.forEach((param) => {
                const [key, value] = param.substring(1).split("=");
                if (key === "code") code = decodeURIComponent(value);
                if (key === "state") state = decodeURIComponent(value);
                if (key === "sessionToken") sessionToken = decodeURIComponent(value);
              });
            }
          }
        }

        if (sessionToken) {
          await Auth.setSessionToken(sessionToken);
          setStatus("success");
          return;
        }

        if (!code || !state) {
          setStatus("error");
          setErrorMessage("Missing code or state parameter");
          return;
        }

        const result = await Api.exchangeOAuthCode(code, state);

        if (result.sessionToken) {
          await Auth.setSessionToken(result.sessionToken);
          if (result.user) {
            const userInfo: Auth.User = {
              id: result.user.id,
              openId: result.user.openId,
              name: result.user.name,
              email: result.user.email,
              loginMethod: result.user.loginMethod,
              lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
            };
            await Auth.setUserInfo(userInfo);
          }
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage("No session token received");
        }
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to complete authentication",
        );
      }
    };

    handleCallback();
    return () => clearTimeout(redirectTimer);
  }, [params.code, params.state, params.error, params.sessionToken, params.user, router]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" color="#F6F6F2" />
            <Text style={[styles.message, styles.processingMessage]}>
              Completing authentication...
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text style={styles.message}>
              Authentication successful!
            </Text>
            <Text style={styles.message}>
              Redirecting...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text style={styles.errorTitle}>
              Authentication failed
            </Text>
            <Text style={styles.message}>
              {errorMessage}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#090909" },
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20, backgroundColor: "#090909" },
  message: { color: "#F6F6F2", fontSize: 16, lineHeight: 24, textAlign: "center" },
  processingMessage: { marginTop: 16 },
  errorTitle: { marginBottom: 8, color: "#FF4D4D", fontSize: 20, fontWeight: "700", lineHeight: 28, textAlign: "center" },
});
