import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/app-icon";
import { DotLabel, NothingCard, nothing } from "@/components/nothing-ui";
import { NativeScreen } from "@/components/screen";

type LegalPage = "privacy" | "terms" | "dmca" | "licenses";

const sections: { key: LegalPage; label: string; detail: string }[] = [
  { key: "privacy", label: "Privacy Policy", detail: "How we collect, use, and protect your data." },
  { key: "terms", label: "Terms of Service", detail: "Account, usage, and acceptable-use conditions." },
  { key: "dmca", label: "DMCA / Copyright", detail: "Copyright notice and counter-notice procedure." },
  { key: "licenses", label: "Open Source Licenses", detail: "Third-party software and their licenses." },
];

function PrivacyPolicy() {
  return <View style={styles.legalContent}>
    <Text style={styles.legalHeading}>Privacy Policy</Text>
    <Text style={styles.legalDate}>Effective: September 2026</Text>
    <Text style={styles.legalBody}>{`Aniraku ("we", "us") operates the Aniraku anime discovery and streaming application. This policy explains what is used, why, and where it lives.\n\n1. INFORMATION WE COLLECT\n\n• Account: email address and verification state for sign-in and recovery.\n• Session: encrypted token in device keychain/keystore, removed on sign-out.\n• Library: progress, bookmarks, ratings, comments, alerts, and profile, synced to your account.\n• On-device only: NSFW preference with its one-time 18+ affirmation, search history, and notification display options — never sent to any server.\n• Metadata: anime titles and provider data per screen from AniList and the Aniraku API; short-lived cache only.\n• We do not collect advertising identifiers or behavioral analytics.\n\n2. HOW WE USE IT\n\n• To provide discovery, playback coordination, and cross-device sync.\n• To show understandable recovery states when something fails.\n• We do not sell personal data.\n\n3. SECURITY\n\n• Traffic is encrypted in transit (TLS).\n• Provider tokens stay server-side and never enter the app.\n• Account records are scoped to the signed-in user.\n\n4. YOUR RIGHTS\n\n• Clear watch history and bookmarks in Settings.\n• Delete your account in Settings — removes your records first, then the login itself. Irreversible.\n• Request a copy of your data: privacy@aniraku.tech.\n\n5. CHILDREN AND ADULT CONTENT\n\n• Not for children under 13.\n• Adult titles stay hidden until you affirm you are 18 or older.\n\n6. CHANGES\n\nMaterial changes will be communicated via in-app notice.\n\n7. CONTACT\n\nprivacy@aniraku.tech`}</Text>
  </View>;
}

function TermsOfService() {
  return <View style={styles.legalContent}>
    <Text style={styles.legalHeading}>Terms of Service</Text>
    <Text style={styles.legalDate}>Effective: September 2026</Text>
    <Text style={styles.legalBody}>{`By using Aniraku you agree to these terms.\n\n1. SERVICE\n\nAniraku is a free anime discovery and playback-coordination interface. It does not host video and grants no rights in third-party content. Quality, subtitles, schedules, and availability come from third parties and can change without notice.\n\n2. ELIGIBILITY\n\nYou must be at least 13. Adult titles require an explicit 18-or-older affirmation and must be lawful where you are.\n\n3. ACCOUNT\n\nVerified email is required for protected features. You are responsible for your credentials and activity. Do not bypass authentication, harvest data, disrupt the service, or abuse deletion and reporting.\n\n4. ACCEPTABLE USE\n\nYou agree not to:\n• Use the app for any illegal purpose.\n• Post unlawful, abusive, infringing, spam, or deceptive content.\n• Interfere with or exploit the service.\n• Redistribute or resell content accessed through the app.\n\n5. INTELLECTUAL PROPERTY\n\nThe Aniraku app is released under the MIT License. Anime content belongs to its respective owners. Copyright concerns follow the DMCA / Copyright section.\n\n6. TERMINATION\n\nYou may stop using the app or delete your account (Settings) at any time. We may restrict or terminate access for violations, including repeat infringement.\n\n7. DISCLAIMERS AND LIABILITY\n\nProvided "as is" and "as available" without warranties. To the maximum extent permitted by law, we are not liable for indirect or consequential damages, including unavailable providers or unsynced data loss.\n\n8. CHANGES\n\nMaterial changes will be communicated via in-app notice or release notes. Continued use constitutes acceptance.\n\n9. CONTACT\n\nlegal@aniraku.tech`}</Text>
  </View>;
}

function DMCAPolicy() {
  return <View style={styles.legalContent}>
    <Text style={styles.legalHeading}>DMCA / Copyright Policy</Text>
    <Text style={styles.legalDate}>Effective: September 2026</Text>
    <Text style={styles.legalBody}>{`Aniraku respects intellectual property rights. Aniraku does not host video files; where valid notices identify reachable material, access is removed or disabled expeditiously.\n\n1. DESIGNATED AGENT\n\nSend notices and counter-notices to:\n\ndmca@aniraku.tech\n\nUse "DMCA Notice" or "DMCA Counter-Notice" in the subject line.\n\n2. TAKEDOWN NOTICES\n\nA valid notice must include:\n• Your signature (physical or electronic).\n• Identification of the copyrighted work.\n• The exact in-app location (route, title, episode, provider) — screenshots alone are not enough.\n• Your name, address, phone, and email.\n• A good-faith belief statement.\n• An accuracy statement under penalty of perjury with your authority to act.\n\nIncomplete notices are returned with an explanation.\n\n3. COUNTER-NOTICES\n\nIf your material was removed by mistake, send your signature, what was removed and where it appeared, a good-faith mistake statement under penalty of perjury, your contact details, and consent to federal court jurisdiction. Access may be restored in 10–14 business days unless the notifier goes to court.\n\n4. REPEAT INFRINGERS\n\nAccounts of repeat infringers are terminated.\n\n5. MISREPRESENTATION\n\nFalse claims can create liability for damages, costs, and attorney's fees.\n\n6. CONTACT\n\ndmca@aniraku.tech`}</Text>
  </View>;
}

function OSSLicenses() {
  const licenses = [
    { name: "react-native", license: "MIT License", copyright: "Copyright (c) Meta Platforms, Inc." },
    { name: "expo", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "react-native-video", license: "MIT License", copyright: "Copyright (c) Airbnb" },
    { name: "react-native-webview", license: "MIT License", copyright: "Copyright (c) Facebook Inc." },
    { name: "@tanstack/react-query", license: "MIT License", copyright: "Copyright (c) Tanner Linsley" },
    { name: "expo-image", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-router", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-haptics", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-secure-store", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-web-browser", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-notifications", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-screen-orientation", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "expo-keep-awake", license: "MIT License", copyright: "Copyright (c) 650 Industries" },
    { name: "@react-native-async-storage/async-storage", license: "MIT License", copyright: "Copyright (c) React Native Community" },
    { name: "react-native-gesture-handler", license: "MIT License", copyright: "Copyright (c) Software Mansion" },
  ];

  return <View style={styles.legalContent}>
    <Text style={styles.legalHeading}>Open Source Licenses</Text>
    <Text style={styles.legalDate}>Aniraku is built with open source software.</Text>
    {licenses.map((lib) => <View key={lib.name} style={styles.licenseRow}>
      <Text style={styles.licenseName}>{lib.name}</Text>
      <Text style={styles.licenseType}>{lib.license}</Text>
      <Text style={styles.licenseCopyright}>{lib.copyright}</Text>
    </View>)}
    <NothingCard style={{ marginTop: 12, padding: 14, gap: 8 }}>
      <Text style={styles.legalBody}>{`Aniraku itself is released under the MIT License.\n\nCopyright (c) 2025-2026 Showaib Islam\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.`}</Text>
    </NothingCard>
  </View>;
}

const contentMap = {
  privacy: PrivacyPolicy,
  terms: TermsOfService,
  dmca: DMCAPolicy,
  licenses: OSSLicenses,
};

export default function LegalScreen() {
  const [activePage, setActivePage] = useState<LegalPage | null>(null);

  if (activePage) {
    const Content = contentMap[activePage];
    return <NativeScreen>
      <Pressable onPress={() => setActivePage(null)} style={styles.back}>
        <AppIcon name="arrow-left" size={18} color={nothing.white} />
        <Text style={styles.backText}>BACK</Text>
      </Pressable>
      <DotLabel>LEGAL</DotLabel>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Content />
      </ScrollView>
    </NativeScreen>;
  }

  return <NativeScreen>
    <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.close}><AppIcon name="arrow-left" size={21} color={nothing.white} /></Pressable><View style={styles.titleBlock}><DotLabel>ACCOUNT / CONTROL ROOM</DotLabel><Text style={styles.title}>Legal</Text></View></View>
    {sections.map((section) => <Pressable key={section.key} onPress={() => setActivePage(section.key)} style={({ pressed }) => pressed && styles.pressed}>
      <NothingCard style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardBody}><Text style={styles.cardTitle}>{section.label}</Text><Text style={styles.copy}>{section.detail}</Text></View>
          <AppIcon name="chevron-right" size={18} color={nothing.muted} />
        </View>
      </NothingCard>
    </Pressable>)}
    <NothingCard style={styles.card}><DotLabel>Contacts</DotLabel><Text style={styles.copy}>Privacy: privacy@aniraku.tech{"\n"}Copyright: dmca@aniraku.tech{"\n"}Legal: legal@aniraku.tech{"\n"}Security: security@aniraku.tech</Text></NothingCard>
  </NativeScreen>;
}

const styles = StyleSheet.create({
  top: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 11 },
  close: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: nothing.line, backgroundColor: nothing.raised },
  titleBlock: { gap: 2 },
  title: { color: nothing.white, fontSize: 25, fontWeight: "900", letterSpacing: -0.65 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  backText: { color: nothing.white, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  card: { padding: 16, gap: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { color: nothing.white, fontWeight: "900", fontSize: 16 },
  copy: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  pressed: nothing.pressed,
  scrollContent: { paddingBottom: 40 },
  legalContent: { gap: 12 },
  legalHeading: { color: nothing.white, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  legalDate: { color: nothing.dim, fontSize: 10, letterSpacing: 0.4 },
  legalBody: { color: nothing.muted, fontSize: 13, lineHeight: 20 },
  licenseRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  licenseName: { color: nothing.white, fontWeight: "800", fontSize: 13 },
  licenseType: { color: nothing.red, fontSize: 10, fontWeight: "700", marginTop: 2 },
  licenseCopyright: { color: nothing.dim, fontSize: 11, marginTop: 2 },
});
