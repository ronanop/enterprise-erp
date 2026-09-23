import { describe, expect, it } from "vitest";

import {
  buildConfigurationString,
  parseConfigurationString,
} from "@/config/asset-hardware-options";

describe("parseConfigurationString", () => {
  it("returns empty fields when configuration is blank", () => {
    expect(parseConfigurationString(null)).toEqual({
      processor: "",
      generation: "",
      ram: "",
      storage: "",
    });
  });

  it("parses labeled configuration from Add Asset", () => {
    expect(
      parseConfigurationString(
        "Processor: Intel i5; Generation: 12th; RAM: 16 GB; Storage: 512 GB",
      ),
    ).toEqual({
      processor: "Intel i5",
      generation: "12th",
      ram: "16 GB",
      storage: "512 GB",
    });
  });

  it("parses compact slash-separated configuration", () => {
    expect(parseConfigurationString("Apple M1 / 16 GB / 512 GB")).toEqual({
      processor: "Apple M1",
      generation: "",
      ram: "16 GB",
      storage: "512 GB",
    });
  });

  it("round-trips with buildConfigurationString", () => {
    const built = buildConfigurationString({
      processor: "Intel i7",
      generation: "13th",
      ram: "32 GB",
      storage: "1 TB",
    });
    expect(parseConfigurationString(built)).toEqual({
      processor: "Intel i7",
      generation: "13th",
      ram: "32 GB",
      storage: "1 TB",
    });
  });
});
