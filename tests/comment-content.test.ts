import { describe, expect, it } from "vitest";
import { canSubmitSharedComment, cleanCommentContent, commentAuthorLabel } from "@/lib/comment-content";

describe("shared comment content", () => {
  it("allows text comments and rejects blank ones", () => {
    expect(canSubmitSharedComment("A thoughtful reaction")).toBe(true);
    expect(canSubmitSharedComment("   ")).toBe(false);
    expect(canSubmitSharedComment("")).toBe(false);
  });

  it("trims comment content to the 2000-character limit", () => {
    expect(cleanCommentContent("  hello  ")).toBe("hello");
    expect(cleanCommentContent("a".repeat(5000)).length).toBe(2000);
  });

  it("uses the profile display name, then username, then an honest fallback for every comment surface", () => {
    expect(commentAuthorLabel({ display_name: "Rin", username: "rin_user", avatar_url: null })).toBe("Rin");
    expect(commentAuthorLabel({ display_name: null, username: "rin_user", avatar_url: null })).toBe("rin_user");
    expect(commentAuthorLabel(null)).toBe("Aniraku member");
  });
});
