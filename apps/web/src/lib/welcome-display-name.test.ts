import { describe, expect, it } from "vitest";

import { welcomeDisplayName } from "@/lib/welcome-display-name";

describe("welcomeDisplayName", () => {
  it("returns a human display name", () => {
    expect(welcomeDisplayName("Ada Lovelace", "ada@example.com")).toBe("Ada Lovelace");
  });

  it("never returns an email as the greeting name", () => {
    expect(welcomeDisplayName("ada@example.com", "ada@example.com")).toBe("there");
    expect(welcomeDisplayName("ada@example.com")).toBe("there");
  });

  it("falls back when name is empty", () => {
    expect(welcomeDisplayName("", "ada@example.com")).toBe("there");
    expect(welcomeDisplayName(null)).toBe("there");
  });
});
