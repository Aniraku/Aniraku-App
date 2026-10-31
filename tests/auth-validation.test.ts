import { describe, expect, it } from "vitest";
import { emailProblemOrTypo, emailTypoSuggestion, validateEmail } from "@/lib/auth-validation";

describe("validateEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(validateEmail("viewer@gmail.com")).toBeNull();
    expect(validateEmail("  spaced@proton.me  ")).toBeNull();
    expect(validateEmail("odd.name+tag@sub.example.co.uk")).toBeNull();
  });

  it("rejects broken shapes", () => {
    expect(validateEmail("")).toMatch(/enter/i);
    expect(validateEmail("no-at-sign")).toMatch(/valid/i);
    expect(validateEmail("two@@ats.com")).toMatch(/valid/i);
    expect(validateEmail("has space@gmail.com")).toMatch(/spaces/i);
    expect(validateEmail("dots..dots@gmail.com")).toMatch(/consecutive/i);
    expect(validateEmail("nolocal@")).toMatch(/valid/i);
    expect(validateEmail("nodomain@localhost")).toMatch(/valid/i);
    expect(validateEmail(`${"x".repeat(250)}@gmail.com`)).toMatch(/too long/i);
  });
});

describe("emailTypoSuggestion", () => {
  it("suggests the obvious fat-finger domains", () => {
    expect(emailTypoSuggestion("viewer@gmial.com")).toBe("viewer@gmail.com");
    expect(emailTypoSuggestion("viewer@gmail.con")).toBe("viewer@gmail.com");
    expect(emailTypoSuggestion("viewer@gmai.com")).toBe("viewer@gmail.com");
    expect(emailTypoSuggestion("viewer@outlok.com")).toBe("viewer@outlook.com");
  });

  it("leaves unknown domains and correct domains alone", () => {
    expect(emailTypoSuggestion("viewer@university.edu")).toBeNull();
    expect(emailTypoSuggestion("viewer@gmail.com")).toBeNull();
    expect(emailTypoSuggestion("viewer@")).toBeNull();
    expect(emailTypoSuggestion("noat.com")).toBeNull();
  });
});

describe("emailProblemOrTypo", () => {
  it("format problems beat typo suggestions", () => {
    expect(emailProblemOrTypo("bad email@gmial.com")).toMatch(/spaces/i);
  });

  it("returns the typo message when the format is fine", () => {
    expect(emailProblemOrTypo("viewer@hotmial.com")).toMatch(/did you mean/i);
    expect(emailProblemOrTypo("viewer@gmail.com")).toBeNull();
  });
});
