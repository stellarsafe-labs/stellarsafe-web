import { describe, expect, it } from "vitest";
import { newMemberError, removalError, roleChangeError } from "../membership";
import { A, state } from "./fixtures";

const admin = { address: A.admin, roles: ["admin", "approver"] as const, addedAt: 0 };

describe("newMemberError", () => {
  it("allows empty input so the field isn't red before typing", () => {
    expect(newMemberError(state(), "  ")).toBeNull();
  });
  it("rejects malformed addresses", () => {
    expect(newMemberError(state(), "GNOTREAL")).toMatch(/valid Stellar address/);
  });
  it("rejects existing members, ignoring surrounding whitespace", () => {
    expect(newMemberError(state(), ` ${A.approver1} `)).toMatch(/already a member/);
  });
  it("accepts a new valid address", () => {
    expect(newMemberError(state(), A.stranger)).toBeNull();
  });
});

describe("roleChangeError", () => {
  it("keeps at least one admin", () => {
    expect(roleChangeError(state(), { ...admin, roles: [...admin.roles] }, ["approver"])).toMatch(/one admin/);
  });
  it("blocks changes that leave too few approvers for the highest tier", () => {
    // Highest tier needs 2 approvers; the fixture has 3. Removing two leaves one.
    const s = state({
      members: state().members.map((m) => (m.address === A.approver2 ? { ...m, roles: [] } : m)),
    });
    const member = s.members.find((m) => m.address === A.approver1)!;
    expect(roleChangeError(s, member, [])).not.toBeNull();
  });
  it("allows a harmless change", () => {
    const s = state();
    const member = s.members.find((m) => m.address === A.proposer)!;
    expect(roleChangeError(s, member, ["proposer", "approver"])).toBeNull();
  });
});

describe("removalError", () => {
  it("won't remove the only admin", () => {
    const s = state();
    expect(removalError(s, s.members[0])).toMatch(/one admin/);
  });
  it("allows removing a plain proposer", () => {
    const s = state();
    expect(
      removalError(
        s,
        s.members.find((m) => m.address === A.proposer)!,
      ),
    ).toBeNull();
  });
});
