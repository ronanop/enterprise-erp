import { describe, expect, it } from "vitest";

import {
  EMPTY_USER_TRANSFER_VERIFICATION,
  isUserTransferVerificationComplete,
  toggleVerifiedComponent,
} from "@/components/assets/user-transfer-verification";

describe("isUserTransferVerificationComplete", () => {
  it("requires data backup", () => {
    expect(
      isUserTransferVerificationComplete(
        {
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          qcCompleted: true,
          physicalCondition: "good",
        },
        [],
      ),
    ).toBe(false);
  });

  it("requires QC", () => {
    expect(
      isUserTransferVerificationComplete(
        {
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          physicalCondition: "good",
        },
        [],
      ),
    ).toBe(false);
  });

  it("requires physical condition", () => {
    expect(
      isUserTransferVerificationComplete(
        {
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
        },
        [],
      ),
    ).toBe(false);
  });

  it("does not block when no components", () => {
    expect(
      isUserTransferVerificationComplete(
        {
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
        },
        [],
      ),
    ).toBe(true);
  });

  it("requires all issued components verified", () => {
    expect(
      isUserTransferVerificationComplete(
        {
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
          verifiedComponentIds: ["c1"],
        },
        ["c1", "c2"],
      ),
    ).toBe(false);

    expect(
      isUserTransferVerificationComplete(
        {
          ...EMPTY_USER_TRANSFER_VERIFICATION,
          dataBackupVerified: true,
          qcCompleted: true,
          physicalCondition: "good",
          verifiedComponentIds: ["c1", "c2"],
        },
        ["c1", "c2"],
      ),
    ).toBe(true);
  });
});

describe("toggleVerifiedComponent", () => {
  it("adds and removes ids", () => {
    expect(toggleVerifiedComponent([], "a", true)).toEqual(["a"]);
    expect(toggleVerifiedComponent(["a", "b"], "a", false)).toEqual(["b"]);
  });
});
