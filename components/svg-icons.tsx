// High-quality SVG icon set for Aniraku App
// Clean, geometric, professional — no gradients, no AI clutter
// All icons: 24x24 viewBox, stroke-based, consistent line weight

import * as React from "react";
import Svg, { Path, Circle, Line, Polyline, Rect, Polygon } from "react-native-svg";

// ── Play ──
export function SvgPlay({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="5 3 19 12 5 21" />
    </Svg>
  );
}

// ── Pause ──
export function SvgPause({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="10" y="4" width="4" height="16" />
      <Rect x="16" y="4" width="4" height="16" />
    </Svg>
  );
}

// ── Skip Back 10 ──
export function SvgSkipBack({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="5" y1="12" x2="19" y2="12" />
      <Polyline points="12 5 5 12 12 19" />
      <Line x1="5" y1="19" x2="5" y2="5" />
    </Svg>
  );
}

// ── Skip Forward 10 ──
export function SvgSkipForward({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="12" x2="5" y2="12" />
      <Polyline points="12 5 19 12 12 19" />
      <Line x1="19" y1="5" x2="19" y2="19" />
    </Svg>
  );
}

// ── Download ──
export function SvgDownload({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </Svg>
  );
}

// ── Lock ──
export function SvgLock({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="11" y="11" width="11" height="11" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

// ── Unlock ──
export function SvgUnlock({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  );
}

// ── Mute / Volume Off ──
export function SvgVolumeOff({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Line x1="23" y1="9" x2="17" y2="15" />
    </Svg>
  );
}

// ── Volume ──
export function SvgVolume({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <Path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </Svg>
  );
}

// ── Settings / Gear ──
export function SvgSettings({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

// ── Search ──
export function SvgSearch({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

// ── Back / Arrow Left ──
export function SvgArrowLeft({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="5" x2="5" y2="12" />
      <Line x1="19" y1="19" x2="5" y2="12" />
      <Line x1="12" y1="5" x2="12" y2="19" />
    </Svg>
  );
}

// ── Forward / Arrow Right ──
export function SvgArrowRight({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="5" y1="5" x2="19" y2="12" />
      <Line x1="5" y1="19" x2="19" y2="12" />
      <Line x1="12" y1="5" x2="12" y2="19" />
    </Svg>
  );
}

// ── Bookmark ──
export function SvgBookmark({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

// ── Bookmark Fill ──
export function SvgBookmarkFill({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M19 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z" />
    </Svg>
  );
}

// ── Share ──
export function SvgShare({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <Polyline points="16 6 12 2 8 6" />
      <Line x1="12" y1="2" x2="12" y2="22" />
    </Svg>
  );
}

// ── Home ──
export function SvgHome({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12l5 5 5-5" />
      <Polyline points="12 2 2 8 12 14 22 8 12 2" />
    </Svg>
  );
}

// ── Menu / Hamburger ──
export function SvgMenu({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="3" y1="12" x2="21" y2="12" />
      <Line x1="3" y1="6" x2="21" y2="6" />
      <Line x1="3" y1="18" x2="21" y2="18" />
    </Svg>
  );
}

// ── Check ──
export function SvgCheck({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

// ── X ──
export function SvgX({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

// ── Chevron Down ──
export function SvgChevronDown({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

// ── Chevron Up ──
export function SvgChevronUp({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="18 15 12 9 6 15" />
    </Svg>
  );
}

// ── Chevron Left ──
export function SvgChevronLeft({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

// ── Chevron Right ──
export function SvgChevronRight({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

// ── Plus ──
export function SvgPlus({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

// ── Minus ──
export function SvgMinus({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

// ── Eye ──
export function SvgEye({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

// ── Eye Off ──
export function SvgEyeOff({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  );
}

// ── Heart ──
export function SvgHeart({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </Svg>
  );
}

// ── Heart Fill ──
export function SvgHeartFill({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <Path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </Svg>
  );
}

// ── Clock / History ──
export function SvgClock({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

// ── Trash ──
export function SvgTrash({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

// ── Refresh / Sync ──
export function SvgRefresh({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 4c0 1.1-.9 2-2 2" />
      <Path d="M20.2 4.8C20 4.3 19.5 4 19 4h-2c-2.8 0-5 2.2-5 5 0 .3.02.6.05.8" />
      <Path d="M1 20c0-1.1.9-2 2-2" />
      <Path d="M3.8 19.2C4 19.7 4.5 20 5 20h2c2.8 0 5-2.2 5-5 0-.3-.02-.6-.05-.8" />
    </Svg>
  );
}

// ── Info ──
export function SvgInfo({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Line x1="12" y1="16" x2="12" y2="12" />
      <Line x1="12" y1="8" x2="12.01" y2="8" />
    </Svg>
  );
}

// ── Alert Triangle ──
export function SvgAlert({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  );
}

// ── Film / Movie ──
export function SvgFilm({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <Line x1="7" y1="2" x2="7" y2="22" />
      <Line x1="17" y1="2" x2="17" y2="22" />
      <Line x1="2" y1="7" x2="22" y2="7" />
      <Line x1="2" y1="17" x2="22" y2="17" />
    </Svg>
  );
}

// ── Bell ──
export function SvgBell({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

// ── Coffee / Hot ──
export function SvgCoffee({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 8h14" />
      <Rect x="4" y="10" width="16" height="10" rx="2" />
      <Line x1="12" y1="8" x2="12" y2="16" />
      <Path d="M9 16h6a2 2 0 0 1 2 2v1H7v-1a2 2 0 0 1 2-2z" />
    </Svg>
  );
}

// ── Map Pin ──
export function SvgMapPin({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0" />
      <Circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

// ── Link ──
export function SvgLink({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54 .54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    </Svg>
  );
}

// ── Arrow Up Right (External / Open in new) ──
export function SvgArrowUpRight({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="14" y1="10" x2="3" y2="21" />
      <Path d="M3 10h11v11" />
    </Svg>
  );
}

// ── Copy ──
export function SvgCopy({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  );
}

// ── Cloud Offline ──
export function SvgCloudOffline({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19.35 10.03A10.003 10.003 0 0 0 16 5c-4.49 0-8.28 3.35-9.54 8M21 12a9 9 0 0 1-9 9c-5 0-7-3-7-3" />
      <Line x1="12" y1="7" x2="12" y2="12" />
      <Line x1="8" y1="12" x2="16" y2="12" />
    </Svg>
  );
}

// ── Calendar ──
export function SvgCalendar({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

// ── Layers / Stack ──
export function SvgLayers({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="12 2 2 8 12 14 22 8 12 2" />
      <Polyline points="12 22 2 16 12 10 22 16 12 22" />
    </Svg>
  );
}

// ── User ──
export function SvgUser({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

// ── Paper Plane / Send ──
export function SvgSend({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="2" y1="11" x2="22" y2="11" />
      <Polyline points="22 2 11 13 2 22" />
    </Svg>
  );
}

// ── Arrow Bend Up Left (Reply / Logout) ──
export function SvgArrowBendUpLeft({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 3v5a1 1 0 0 1-1 1H5" />
      <Polyline points="18 7 13 12 18 17" />
    </Svg>
  );
}

// ── File Document ──
export function SvgFileDocument({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
    </Svg>
  );
}

// ── Sliders Horizontal (Tune) ──
export function SvgSlidersHorizontal({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="11" y1="5" x2="11" y2="19" />
      <Line x1="4" y1="9" x2="4" y2="15" />
      <Line x1="18" y1="11" x2="18" y2="17" />
      <Line x1="12" y1="13" x2="12" y2="13" />
    </Svg>
  );
}

// ── Speedometer ──
export function SvgSpeedometer({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11.53 8.19a10 10 0 0 0-5.06 3.54A10 10 0 0 0 2.94 17c1.65 1.65 3.85 2.57 6.05 2.57 3.95 0 7.6-2.9 8.48-6.82a10 10 0 0 0 .38-3.73z" />
      <Line x1="1" y1="22" x2="23" y2="22" />
      <Polyline points="12 22 12 14" />
    </Svg>
  );
}

// ── Subtitles ──
export function SvgSubtitles({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="10" width="16" height="8" rx="2" />
      <Line x1="12" y1="14" x2="12" y2="18" />
    </Svg>
  );
}

// ── Picture In Picture ──
export function SvgPictureInPicture({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="4" width="16" height="16" rx="2" />
      <Rect x="8" y="8" width="8" height="8" rx="1" />
    </Svg>
  );
}

// ── Arrows Out (Fullscreen Enter) ──
export function SvgArrowsOut({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="5" y1="5" x2="11" y2="5" />
      <Line x1="5" y1="5" x2="5" y2="11" />
      <Line x1="19" y1="19" x2="13" y2="19" />
      <Line x1="19" y1="19" x2="19" y2="13" />
    </Svg>
  );
}

// ── Arrows In (Fullscreen Exit) ──
export function SvgArrowsIn({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="19" y1="5" x2="13" y2="5" />
      <Line x1="19" y1="5" x2="19" y2="11" />
      <Line x1="5" y1="19" x2="11" y2="19" />
      <Line x1="5" y1="19" x2="5" y2="13" />
    </Svg>
  );
}

// ── Rewind ──
export function SvgRewind({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="11 19 2 12 11 5" />
      <Polygon points="17 19 8 12 17 5" />
    </Svg>
  );
}

// ── Fast Forward ──
export function SvgFastForward({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="13 19 22 12 13 5" />
      <Polygon points="7 19 16 12 7 5" />
    </Svg>
  );
}

// ── Grid / Stack ──
export function SvgGrid({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="7" height="7" />
      <Rect x="14" y="3" width="7" height="7" />
      <Rect x="14" y="14" width="7" height="7" />
      <Rect x="3" y="14" width="7" height="7" />
    </Svg>
  );
}

// ── History (clock with counter-clockwise arrow) ──
export function SvgHistory({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3v5h5" />
      <Path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <Polyline points="12 7 12 12 15 14" />
    </Svg>
  );
}

// ── Bookmark (outline) ──
export function SvgBookmarkOutline({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

// ── Bookmark Remove (outline + minus) ──
export function SvgBookmarkRemove({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      <Line x1="9" y1="8" x2="15" y2="8" />
    </Svg>
  );
}

// ── Comment (outline) ──
export function SvgCommentOutline({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

// ── Circle (outline) ──
export function SvgCircleOutline({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
    </Svg>
  );
}

// ── Dice ──
export function SvgDice({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="4" width="16" height="16" rx="3" />
      <Circle cx="8.75" cy="8.75" r="1.1" fill={color} stroke="none" />
      <Circle cx="15.25" cy="8.75" r="1.1" fill={color} stroke="none" />
      <Circle cx="12" cy="12" r="1.1" fill={color} stroke="none" />
      <Circle cx="8.75" cy="15.25" r="1.1" fill={color} stroke="none" />
      <Circle cx="15.25" cy="15.25" r="1.1" fill={color} stroke="none" />
    </Svg>
  );
}

// ── Fire (flame) ──
export function SvgFire({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

// ── Logout (leave through a door) ──
export function SvgLogout({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

// ── Phone Download (install on device) ──
export function SvgPhoneDownload({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="6" y="2" width="12" height="20" rx="2.5" />
      <Line x1="12" y1="7" x2="12" y2="13" />
      <Polyline points="9.5 10.5 12 13 14.5 10.5" />
    </Svg>
  );
}

// ── Index map (name → component) ──
export const SVG_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  "arrow-left": SvgArrowLeft,
  "arrow-top-right": SvgArrowUpRight,
  "chevron-left": SvgChevronLeft,
  "chevron-right": SvgChevronRight,
  "chevron-up": SvgChevronUp,
  "chevron-down": SvgChevronDown,
  "magnify": SvgSearch,
  "home": SvgHome,
  "home-variant-outline": SvgHome,
  "play": SvgPlay,
  "play-circle": SvgPlay,
  "play-circle-outline": SvgPlay,
  "fire": SvgFire,
  "sync": SvgRefresh,
  "refresh": SvgRefresh,
  "tune-variant": SvgSlidersHorizontal,
  "link-variant": SvgLink,
  "share-variant": SvgShare,
  "open-in-new": SvgArrowUpRight,
  "content-copy": SvgCopy,
  "sleep": SvgClock,
  "close": SvgX,
  "eye-off-outline": SvgEyeOff,
  "eye-outline": SvgEye,
  "eye": SvgEye,
  "send": SvgSend,
  "reply-outline": SvgArrowBendUpLeft,
  "reply": SvgArrowBendUpLeft,
  "trash-can-outline": SvgTrash,
  "clock-outline": SvgClock,
  "clock-counter": SvgClock,
  "download": SvgDownload,
  "rewind-10": SvgSkipBack,
  "fast-forward": SvgSkipForward,
  "fast-forward-10": SvgSkipForward,
  "layers": SvgLayers,
  "bell": SvgBell,
  "bell-outline": SvgBell,
  "bookmark": SvgBookmark,
  "bookmark-multiple-outline": SvgBookmark,
  "bookmark-outline": SvgBookmarkOutline,
  "bookmark-remove-outline": SvgBookmarkRemove,
  "history": SvgHistory,
  "comment-outline": SvgCommentOutline,
  "circle-outline": SvgCircleOutline,
  "cog-outline": SvgSettings,
  "heart": SvgHeartFill,
  "heart-outline": SvgHeart,
  "account-edit-outline": SvgUser,
  "account": SvgUser,
  "account-circle-outline": SvgUser,
  "movie-open-outline": SvgFilm,
  "cloud-offline-outline": SvgCloudOffline,
  "calendar": SvgCalendar,
  "calendar-blank-outline": SvgCalendar,
  "view-grid-outline": SvgGrid,
  "delete-forever-outline": SvgTrash,
  "logout": SvgLogout,
  "cellphone-arrow-down": SvgPhoneDownload,
  "dice": SvgDice,
  "shuffle": SvgRefresh,
  "information": SvgInfo,
  "file-document-outline": SvgFileDocument,
  // Player-specific names
  "options": SvgMenu,
  "volume-high": SvgVolume,
  "speaker-none": SvgVolumeOff,
  "pause": SvgPause,
  "skip-back": SvgSkipBack,
  "skip-forward": SvgSkipForward,
  "lock": SvgLock,
  "pip": SvgPictureInPicture,
  "picture-in-picture": SvgPictureInPicture,
  "arrows-out": SvgArrowsOut,
  "arrows-in": SvgArrowsIn,
  "subtitles": SvgSubtitles,
  "speedometer": SvgSpeedometer,
  "gear": SvgSettings,
  "check": SvgCheck,
  "x": SvgX,
};
