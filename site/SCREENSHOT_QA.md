# Screenshot QA

## Native mobile captures — 2026-08-16

The Android portrait Profile capture is a genuine signed-in app screen and is eligible for the public gallery with a truthful **Profile / synced library** caption.

v2.1 changes the unauthenticated `/library?tab=alerts` route into a genuine guest Alerts preview. It clearly states that alerts are synchronized after sign-in and that no alerts are invented for guest sessions. The public `alerts-preview.png` asset is an actual Expo render of that native screen, captured on 2026-08-16. It must be captioned as **Alerts / guest preview**, not as an authenticated notification feed.

The inspected user-provided device capture `Screenshot_20260816_083907_Aniraku.jpg` is a genuine Aniraku Home screen. It is not a Profile or Notifications capture and will not be relabeled for the new gallery entries.

The inspected user-provided device capture `Screenshot_20260816_083941_Aniraku.jpg` is a genuine signed-in Aniraku Profile screen. It is eligible for the public gallery as **Profile / synced library**. The capture sheet contains real Home, Catalog, Schedule, Explore, Profile, Library, Settings, Detail, and Watch screens; it contains no real Notifications or Alerts screen. The public gallery will not invent or relabel one.

The new v2.1 gallery therefore uses only two added assets: `profile.jpg`, copied from the verified signed-in device capture above, and `alerts-preview.png`, captured from the implemented guest Alerts interface. Neither is generated imagery or a mislabeled authenticated notification state.
