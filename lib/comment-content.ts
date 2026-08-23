const GIPHY_HOST = /^(?:media\d*|i)\.giphy\.com$/i;

export type GiphyReaction = {
  id: string;
  url: string;
  previewUrl: string;
  label: string;
  aspectRatio: number;
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
  const preview = images.fixed_width_small ?? images.fixed_width ?? images.downsized ?? images.original ?? {};
  const previewUrl = preview.url ?? images.downsized_still?.url ?? url;
  if (!isTrustedGiphyGifUrl(url) || !isTrustedGiphyGifUrl(previewUrl)) return null;
  const width = Number(preview.width);
  const height = Number(preview.height);
  const aspectRatio = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1;
  return {
    id: String(record?.id ?? url),
    url,
    previewUrl,
    label: String(record?.title ?? record?.slug ?? "Animated reaction").trim() || "Animated reaction",
    aspectRatio,
  };
}
