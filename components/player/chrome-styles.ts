// ═══════════════════════════════════════════════════════════════════════════════
// PLAYER CHROME STYLES — 1:1 th3-anime layout, Aniraku red theme
// Import this alongside your existing `styles` / `ps` objects.
// ═══════════════════════════════════════════════════════════════════════════════
import { StyleSheet } from "react-native";
import { nothing } from "@/components/nothing-ui";

export const chrome = StyleSheet.create({
  // ── Controls backdrop ──
  controlsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  topTitle: {
    flex: 1,
    color: "#FFF",
    fontFamily: "Caveat-Bold",
    fontSize: 17,
    lineHeight: 20,
    marginLeft: 4,
    marginRight: 4,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  serverPill: {
    backgroundColor: nothing.red,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 2,
  },
  serverPillText: {
    color: nothing.black,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  // ── Bottom deck ──
  bottomDeck: {
    gap: 6,
  },
  pillRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  resumePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(9,9,9,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
  },
  resumePillText: {
    color: "#FFF",
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "900",
  },
  skipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: nothing.red,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 5,
  },
  skipPillText: {
    color: "#FFF",
    fontFamily: "Caveat-Bold",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Timeline ──
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeText: {
    color: "#FFF",
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    minWidth: 38,
    textAlign: "center",
  },
  timelineTrack: {
    flex: 1,
    height: 16,
    justifyContent: "center",
  },
  timelineBuffered: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  timelinePlayed: {
    position: "absolute",
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: nothing.red,
  },
  timelineKnob: {
    position: "absolute",
    top: 2,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: "#FFF",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },

  // ── Action rail ──
  actionRail: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  railSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minWidth: 80,
  },
  railSideRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    minWidth: 80,
  },
  railCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  railBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  railBtnDisabled: {
    opacity: 0.3,
  },
  playFab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  // ── Locked overlay ──
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  lockedPillText: {
    color: "#FFF",
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  // ── 2x Speed badge ──
  badge2x: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    zIndex: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badge2xText: {
    color: "#FFF",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // ── Vertical volume bar (right side) ──
  verticalBarWrap: {
    position: "absolute",
    right: 16,
    top: "20%",
    bottom: "25%",
    zIndex: 15,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  verticalBarWrapLeft: {
    position: "absolute",
    left: 16,
    top: "20%",
    bottom: "25%",
    zIndex: 15,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  verticalBarBg: {
    width: 4,
    height: 120,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  verticalBarFill: {
    width: "100%",
    borderRadius: 2,
    backgroundColor: "#FFF",
  },
  verticalBarFillBright: {
    width: "100%",
    borderRadius: 2,
    backgroundColor: "#FFD600",
  },
  verticalBarLabel: {
    alignItems: "center",
    gap: 3,
  },
  verticalBarText: {
    color: "#FFF",
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "800",
  },

  // ── Double-tap seek ripple ──
  doubleTapOverlay: {
    position: "absolute",
    top: "25%",
    width: "35%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  doubleTapCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  doubleTapLabel: {
    color: "#FFF",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
