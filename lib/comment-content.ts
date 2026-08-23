const GIPHY_HOST = /^(?:media\d*|i)\.giphy\.com$/i;

export type GiphyReaction = {
  id: string;
  url: string;
  previewUrl: string;
  label: string;
};

export type CommentAuthorIdentity = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function commentAuthorLabel(author: CommentAuthorIdentity | null | undefined) {
  return author?.display_name || author?.username || "Aniraku member";
}

export function isTrustedGiphyGifUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && GIPHY_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export function cleanCommentContent(value: unknown) {
  return String(value ?? "").trim().slice(0, 2000);
}

export function canSubmitSharedComment(content: unknown, gifUrl: unknown) {
  return Boolean(cleanCommentContent(content) || isTrustedGiphyGifUrl(gifUrl));
}

export function toGiphyReaction(record: any): GiphyReaction | null {
  const images = record?.images ?? {};
  const url = images.downsized?.url ?? images.fixed_width?.url ?? images.original?.url ?? "";
  const previewUrl = images.fixed_width_small?.url ?? images.fixed_width?.url ?? images.downsized_still?.url ?? url;
  if (!isTrustedGiphyGifUrl(url) || !isTrustedGiphyGifUrl(previewUrl)) return null;
  return {
    id: String(record?.id ?? url),
    url,
    previewUrl,
    label: String(record?.title ?? record?.slug ?? "Animated reaction").trim() || "Animated reaction",
  };
}
