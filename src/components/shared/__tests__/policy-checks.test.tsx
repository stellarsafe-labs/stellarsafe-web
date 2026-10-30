// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PolicyChecks } from "../policy-checks";
import { StatusBadge } from "../status-badge";

describe("PolicyChecks", () => {
  it("announces each check's state to screen readers, not just by color", () => {
    render(
      <PolicyChecks
        checks={[
          { id: "allowlist", label: "Recipient allowlist", status: "pass", detail: "Allowlisted" },
          { id: "monthly_limit", label: "Marketing limit", status: "fail", detail: "Only 10 left" },
        ]}
      />,
    );
    expect(screen.getByText("Passes:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Fails:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Only 10 left")).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("renders a text label for every status", () => {
    render(<StatusBadge status="stale" />);
    expect(screen.getByText("Policy changed")).toBeInTheDocument();
  });
});
