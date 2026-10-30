import { describe, expect, it } from "vitest";
import { setupSchema, DEFAULT_POLICY } from "../create-treasury/setup-schema";
import { proposalSchema } from "../new-proposal/schema";
import { diffPolicy, formToPolicy, policyFormSchema, policyToForm, slugify } from "../policy-form";
import { A, policy } from "@/lib/domain/__tests__/fixtures";

const issues = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe("setupSchema (create treasury)", () => {
  const valid = { name: "Acme", members: [{ address: A.admin, roles: ["admin" as const] }] };

  it("accepts a minimal valid setup", () => {
    expect(setupSchema.safeParse(valid).success).toBe(true);
  });
  it("requires at least one admin", () => {
    const r = setupSchema.safeParse({ ...valid, members: [{ address: A.admin, roles: ["approver"] }] });
    expect(issues(r)).toContain("At least one member must be an admin.");
  });
  it("flags duplicate addresses on the second entry", () => {
    const r = setupSchema.safeParse({ ...valid, members: [valid.members[0], valid.members[0]] });
    expect(r.success).toBe(false);
    expect(r.error!.issues.find((i) => i.message === "Duplicate address")?.path).toEqual(["members", 1, "address"]);
  });
  it("rejects invalid addresses", () => {
    const r = setupSchema.safeParse({ ...valid, members: [{ address: "nope", roles: ["admin"] }] });
    expect(issues(r)).toContain("Invalid Stellar address");
  });
  it("ships a default policy that passes its own schema", () => {
    expect(policyFormSchema.safeParse(DEFAULT_POLICY).success).toBe(true);
  });
});

describe("proposalSchema (new payment)", () => {
  const valid = { title: "Rent", recipient: A.vendor, amount: "12.5", departmentId: "eng" };

  it("accepts a valid proposal", () => {
    expect(proposalSchema.safeParse(valid).success).toBe(true);
  });
  it.each([
    ["0", "zero"],
    ["-1", "negative"],
    ["1.12345678", "more than 7 decimals"],
    ["abc", "not a number"],
  ])("rejects amount %s (%s)", (amount) => {
    expect(issues(proposalSchema.safeParse({ ...valid, amount }))).toContain(
      "Enter an amount greater than 0 (up to 7 decimals)",
    );
  });
  it("requires a department and a real recipient", () => {
    const r = proposalSchema.safeParse({ ...valid, departmentId: "", recipient: "G123" });
    expect(issues(r)).toEqual(
      expect.arrayContaining(["Choose the budget this payment comes from", "Enter a valid Stellar address (G… or C…)"]),
    );
  });
});

describe("policy form conversion", () => {
  it("round-trips an on-chain policy through the form without changes", () => {
    const p = policy();
    expect(diffPolicy(p, formToPolicy(policyToForm(p)), "USDC")).toEqual([]);
  });
  it("describes each change in plain language", () => {
    const p = policy();
    const form = policyToForm(p);
    form.allowSelfApproval = true;
    form.departments[0].monthlyLimit = "2000";
    form.departments.push({ id: "ops", name: "Ops", monthlyLimit: "50" });
    expect(diffPolicy(p, formToPolicy(form), "USDC")).toEqual([
      "Engineering limit 1,000 USDC → 2,000 USDC",
      "New department Ops (50 USDC/month)",
      "Self-approval allowed",
    ]);
  });
  it("slugifies department names and avoids taken ids", () => {
    expect(slugify("Marketing & Growth!", [])).toBe("marketing_growth");
    expect(slugify("Ops", ["ops", "ops_2"])).toBe("ops_3");
    expect(slugify("¿¿", [])).toBe("dept");
  });
});
