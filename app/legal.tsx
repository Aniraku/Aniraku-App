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
    <Text style={styles.legalDate}>Effective: August 2026</Text>
    <Text style={styles.legalBody}>{`Aniraku ("we", "us") operates the Aniraku anime discovery and streaming application. This Privacy Policy explains how we collect, use, and protect information when you use our app.\n\n1. INFORMATION WE COLLECT\n\n• Account Information: Email address and authentication tokens when you sign in via AniList or MyAnimeList.\n• Watch History: Episode progress, timestamps, and viewing preferences synced to your account.\n• Device Information: Device model, OS version, and app version for compatibility and debugging.\n• Usage Data: Features used, search queries, and navigation patterns to improve the app.\n\n2. HOW WE USE YOUR INFORMATION\n\n• To provide and maintain the core streaming and library features.\n• To sync your watch progress across devices.\n• To personalize recommendations and episode suggestions.\n• To debug issues and improve app performance.\n\n3. DATA SHARING\n\nWe do not sell your personal data. We may share anonymized, aggregated usage statistics with analytics providers. We do not share your email or watch history with third parties.\n\n4. DATA STORAGE\n\nWatch history and bookmarks are stored locally on your device and optionally synced to our backend when you are signed in. Data is encrypted in transit (TLS) and at rest.\n\n5. YOUR RIGHTS\n\n• You may clear your watch history and bookmarks at any time from Settings.\n• You may delete your account from Settings > Delete Account.\n• You may request a copy of your data by contacting privacy@aniraku.tech.\n\n6. CHILDREN'S PRIVACY\n\nAniraku is not intended for users under 13. We do not knowingly collect data from children.\n\n7. CHANGES\n\nWe may update this policy. Material changes will be communicated via in-app notice.\n\n8. CONTACT\n\nprivacy@aniraku.tech`}</Text>
  </View>;
}

function TermsOfService() {
  return <View style={styles.legalContent}>
    <Text style={styles.legalHeading}>Terms of Service</Text>
    <Text style={styles.legalDate}>Effective: August 2026</Text>
    <Text style={styles.legalBody}>{`By using Aniraku you agree to these terms.\n\n1. SERVICE\n\nAniraku is a free anime discovery and streaming aggregator. We do not host content; we aggregate streams from third-party providers. Content availability depends on third-party providers and may change without notice.\n\n2. ACCOUNT\n\nYou may sign in using AniList or MyAnimeList. You are responsible for maintaining the security of your linked accounts. You may delete your Aniraku account at any time from Settings.\n\n3. ACCEPTABLE USE\n\nYou agree not to:\n• Use the app for any illegal purpose.\n• Attempt to reverse-engineer or exploit the app.\n• Interfere with or disrupt the service.\n• Redistribute or resell content accessed through the app.\n\n4. INTELLECTUAL PROPERTY\n\nThe Aniraku app is released under the MIT License. Anime content is the property of its respective copyright holders. Aniraku does not claim ownership of any anime content.\n\n5. AVAILABILITY\n\nWe strive to keep the service running but do not guarantee uninterrupted access. Third-party providers may become unavailable at any time.\n\n6. LIMITATION OF LIABILITY\n\nAniraku is provided "as is" without warranties. We are not liable for any damages arising from use of the app.\n\n7. CHANGES\n\nWe may modify these terms. Continued use after changes constitutes acceptance.\n\n8. CONTACT\n\nlegal@aniraku.tech`}</Text>
  </View>;
}

function DMCAPolicy() {
  return <View style={styles.legalContent}>
    <Text style={styles.legalHeading}>DMCA / Copyright Policy</Text>
    <Text style={styles.legalDate}>Effective: August 2026</Text>
    <Text style={styles.legalBody}>{`Aniraku respects the intellectual property rights of others and expects users to do the same.\n\n1. DMCA NOTICES\n\nIf you believe content accessible through Aniraku infringes your copyright, please send a DMCA notice to:\n\ndmca@aniraku.tech\n\nYour notice must include:\n• A description of the copyrighted work.\n• The URL or location of the infringing material.\n• Your contact information.\n• A statement of good-faith belief.\n• A physical or electronic signature.\n\n2. COUNTER-NOTICE\n\nIf your content was removed by mistake, you may file a counter-notice at dmca@aniraku.tech with the same information requirements.\n\n3. REPEAT INFRINGERS\n\nWe may terminate accounts of users who repeatedly infringe copyrights.\n\n4. GOOD FAITH\n\nAniraku acts as a streaming aggregator and does not host content directly. We respond promptly to valid DMCA requests.\n\n5. CONTACT\n\ndmca@aniraku.tech`}</Text>
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
    { name: "react-native-reanimated", license: "MIT License", copyright: "Copyright (c) Software Mansion" },
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
      <Text style={styles.legalBody}>{`Aniraku itself is released under the MIT License.\n\nCopyright (c) 2025-2026 Aniraku Contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.`}</Text>
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
  backText: { color: nothing.white, fontFamily: "monospace", fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
  card: { padding: 16, gap: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { color: nothing.white, fontWeight: "900", fontSize: 16 },
  copy: { color: nothing.muted, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  scrollContent: { paddingBottom: 40 },
  legalContent: { gap: 12 },
  legalHeading: { color: nothing.white, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  legalDate: { color: nothing.dim, fontFamily: "monospace", fontSize: 10, letterSpacing: 0.4 },
  legalBody: { color: nothing.muted, fontSize: 13, lineHeight: 20 },
  licenseRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: nothing.line },
  licenseName: { color: nothing.white, fontWeight: "800", fontSize: 13 },
  licenseType: { color: nothing.red, fontFamily: "monospace", fontSize: 10, fontWeight: "700", marginTop: 2 },
  licenseCopyright: { color: nothing.dim, fontSize: 11, marginTop: 2 },
});
