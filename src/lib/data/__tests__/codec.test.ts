import { describe, expect, it } from "vitest";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { contractErrorCode, decodePolicy, decodeProposal, encodePolicy, native } from "../live/codec";
import { contractErrorFromCode } from "@/lib/domain/types";
import { toUnits } from "@/lib/domain/amount";
import { demoAccount, demoContract } from "../demo/personas";

const vendor = demoAccount("codec-vendor");

describe("contract codec", () => {
  it("encodes policy structs with sorted symbol keys and decodes them back", () => {
    const input = {
      approvalTiers: [
        { minAmount: 0n, requiredApprovals: 1 },
        { minAmount: toUnits(500), requiredApprovals: 2 },
      ],
      allowlistEnabled: true,
      allowlist: [{ address: vendor, label: "Vendor" }],
      departments: [{ id: "eng", name: "Engineering", monthlyLimit: toUnits(8000) }],
      approvalTtlSeconds: 604_800,
      allowSelfApproval: false,
    };
    const scv = encodePolicy(input);
    expect(scv.type).toBe("scvMap");
    const keys = (scv as xdr.ScValMap).map!.map((e) => String(native(e.key)));
    expect(keys).toEqual([...keys].sort());

    const raw = native(scv) as Record<string, unknown>;
    const decoded = decodePolicy({ ...raw, version: 3, updated_at: 1_700_000_000n });
    expect(decoded).toMatchObject({ ...input, version: 3, updatedAt: 1_700_000_000_000 });
  });

  it("decodes proposals, converting seconds to ms and enum status", () => {
    const raw = native(
      nativeToScVal({
        id: 7n,
        proposer: vendor,
        recipient: vendor,
        amount: toUnits(12),
        department: "eng",
        policy_version: 2,
        created_at: 100n,
        expires_at: 200n,
        status: ["Pending"],
        approvals: [],
      }),
    ) as Record<string, unknown>;
    const p = decodeProposal(demoContract("x"), raw);
    expect(p).toMatchObject({
      id: 7,
      amount: toUnits(12),
      createdAt: 100_000,
      expiresAt: 200_000,
      status: "pending",
      departmentId: "eng",
    });
  });

  it("maps contract error codes", () => {
    expect(contractErrorCode("HostError: Error(Contract, #19)")).toBe(19);
    expect(contractErrorCode("something else")).toBeNull();
    expect(contractErrorFromCode(19)?.code).toBe("MonthlyLimitExceeded");
    expect(contractErrorFromCode(999)).toBeNull();
  });
});
