export type CommentAuthorIdentity = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function commentAuthorLabel(author: CommentAuthorIdentity | null | undefined) {
  return author?.display_name || author?.username || "Aniraku member";
}

export function cleanCommentContent(value: unknown) {
  return String(value ?? "").trim().slice(0, 2000);
}

export function canSubmitSharedComment(content: unknown) {
  return Boolean(cleanCommentContent(content));
}
