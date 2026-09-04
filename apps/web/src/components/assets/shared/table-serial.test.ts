/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { tableRowSerial, tableRowSerialFromIndex } from "./table-serial";

describe("tableRowSerial", () => {
  it("numbers within the first page from 1", () => {
    expect(tableRowSerial(1, 25, 0)).toBe(1);
    expect(tableRowSerial(1, 25, 24)).toBe(25);
  });

  it("continues across pages using page size", () => {
    expect(tableRowSerial(2, 25, 0)).toBe(26);
    expect(tableRowSerial(3, 10, 4)).toBe(25);
  });

  it("falls back safely for invalid page/size", () => {
    expect(tableRowSerial(0, 25, 0)).toBe(1);
    expect(tableRowSerial(1, 0, 2)).toBe(3);
  });
});

describe("tableRowSerialFromIndex", () => {
  it("is 1-based for unpaginated lists", () => {
    expect(tableRowSerialFromIndex(0)).toBe(1);
    expect(tableRowSerialFromIndex(5)).toBe(6);
  });
});
