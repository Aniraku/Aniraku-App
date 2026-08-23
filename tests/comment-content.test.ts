import { describe, expect, it } from "vitest";
import { canSubmitSharedComment, cleanCommentContent, commentAuthorLabel, isTrustedGiphyGifUrl, toGiphyReaction } from "@/lib/comment-content";

describe("shared comment content", () => {
  const trustedGif = "https://media.giphy.com/media/3o6Zt481isNVuQI1l6/giphy.gif";

  it("accepts the same trusted GIPHY media hosts as the web client", () => {
    expect(isTrustedGiphyGifUrl(trustedGif)).toBe(true);
    expect(isTrustedGiphyGifUrl("https://example.com/reaction.gif")).toBe(false);
  });

  it("allows text-only or trusted GIF-only shared comments", () => {
    expect(canSubmitSharedComment("A thoughtful reaction", "")).toBe(true);
    expect(canSubmitSharedComment("", trustedGif)).toBe(true);
    expect(canSubmitSharedComment("", "https://example.com/reaction.gif")).toBe(false);
  });

  it("uses original GIPHY media and dimensions without trusting an arbitrary URL", () => {
    expect(toGiphyReaction({ id: "gif-1", title: "Reaction", images: { fixed_width_small: { url: "https://media.giphy.com/media/thumbnail/giphy.gif", width: "120", height: "80" }, original: { url: trustedGif, width: "300", height: "200" } } })).toMatchObject({ id: "gif-1", url: trustedGif, previewUrl: trustedGif, label: "Reaction", aspectRatio: 1.5 });
    expect(toGiphyReaction({ images: { original: { url: "https://example.com/bad.gif" } } })).toBeNull();
    expect(cleanCommentContent("  hello  ")).toBe("hello");
  });

  it("uses the profile display name, then username, then an honest fallback for every comment surface", () => {
    expect(commentAuthorLabel({ display_name: "Rin", username: "rin_user", avatar_url: null })).toBe("Rin");
    expect(commentAuthorLabel({ display_name: null, username: "rin_user", avatar_url: null })).toBe("rin_user");
    expect(commentAuthorLabel(null)).toBe("Aniraku member");
  });
});
