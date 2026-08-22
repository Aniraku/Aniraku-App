export function updatePromptCopy(installedVersion: string, releaseVersion: string) {
  return {
    label: `ANIRAKU V${releaseVersion} / UPDATE READY`,
    title: `Aniraku v${releaseVersion} is ready.`,
    body: `You are using v${installedVersion}. Download the verified official v${releaseVersion} APK and let Android’s system installer complete the update.`,
    installLabel: `INSTALL V${releaseVersion}`,
  };
}
