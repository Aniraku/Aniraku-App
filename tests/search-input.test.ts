import { describe, expect, it } from "vitest";
import { MID_WORD_COMMIT_MS, WORD_END_COMMIT_MS, searchCommitDelayMs } from "../lib/search-input";

describe("search word-boundary commit timing", () => {
  it("commits quickly when the text ends a word (trailing space or punctuation)", () => {
    expect(searchCommitDelayMs("one piece ")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("frieren,")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("attack on titan!")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("dandadan?")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("spy x family;")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("kaiju no. 8:")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("re:zero —")).toBe(WORD_END_COMMIT_MS);
    expect(searchCommitDelayMs("mob psycho 100-")).toBe(WORD_END_COMMIT_MS);
  });

  it("waits for a mid-word pause when the text ends inside a word", () => {
    expect(searchCommitDelayMs("one piec")).toBe(MID_WORD_COMMIT_MS);
    expect(searchCommitDelayMs("f")).toBe(MID_WORD_COMMIT_MS);
    expect(searchCommitDelayMs("dandadan")).toBe(MID_WORD_COMMIT_MS);
  });

  it("treats empty text as a mid-word pause", () => {
    expect(searchCommitDelayMs("")).toBe(MID_WORD_COMMIT_MS);
  });
});
