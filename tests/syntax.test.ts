import { describe, expect, it } from "vitest";
import { findRoutedLinks, isHttpUrl, validateSyntax } from "../src/syntax";

describe("private-link syntax", () => {
  it("finds curly-brace links by default", () => {
    expect(findRoutedLinks("See {https://example.com/a?q=1}.", {
      openingDelimiter: "{",
      closingDelimiter: "}"
    })).toEqual([{ from: 4, to: 31, url: "https://example.com/a?q=1" }]);
  });

  it("supports configurable delimiter characters", () => {
    expect(findRoutedLinks("Open §https://example.com§ now", {
      openingDelimiter: "§",
      closingDelimiter: "§"
    })[0]?.url).toBe("https://example.com");
  });

  it("ignores ordinary links", () => {
    expect(findRoutedLinks("https://example.com", {
      openingDelimiter: "{",
      closingDelimiter: "}"
    })).toHaveLength(0);
  });

  it("rejects empty or whitespace delimiters", () => {
    expect(validateSyntax({ openingDelimiter: "", closingDelimiter: "}" })).toBeTruthy();
    expect(validateSyntax({ openingDelimiter: "{", closingDelimiter: " " })).toBeTruthy();
  });
});

describe("URL validation", () => {
  it("allows only HTTP and HTTPS URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("file:///tmp/example")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
