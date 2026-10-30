// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddMemberDialog, LabelDialog, RolesDialog } from "../members/member-dialogs";
import { A, state } from "@/lib/domain/__tests__/fixtures";

afterEach(cleanup);

describe("AddMemberDialog", () => {
  it("only enables Continue for a valid new address and submits trimmed values", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AddMemberDialog state={state()} onClose={vi.fn()} onSubmit={onSubmit} />);
    const cont = screen.getByRole("button", { name: "Continue" });
    expect(cont).toBeDisabled();

    await user.type(screen.getByLabelText("Stellar address"), A.approver1);
    expect(screen.getByText("This address is already a member")).toBeInTheDocument();
    expect(cont).toBeDisabled();

    await user.clear(screen.getByLabelText("Stellar address"));
    await user.type(screen.getByLabelText("Stellar address"), ` ${A.stranger} `);
    await user.type(screen.getByLabelText(/Display label/), "Jordan ");
    await user.click(screen.getByLabelText("Proposer"));
    await user.click(cont);
    expect(onSubmit).toHaveBeenCalledWith({ address: A.stranger, label: "Jordan", roles: ["approver", "proposer"] });
  });
});

describe("RolesDialog", () => {
  it("blocks removing the admin role from the last admin", async () => {
    const s = state();
    const user = userEvent.setup();
    render(<RolesDialog state={s} member={s.members[0]} memberLabel="Admin" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    await user.click(screen.getByLabelText("Admin"));
    expect(screen.getByText("A treasury must keep at least one admin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("LabelDialog", () => {
  it("saves the trimmed label and disables the button while saving", async () => {
    let done!: () => void;
    const onSave = vi.fn(() => new Promise<void>((r) => (done = r)));
    const user = userEvent.setup();
    render(<LabelDialog initial="Old" onClose={vi.fn()} onSave={onSave} />);
    await user.clear(screen.getByLabelText("Label"));
    await user.type(screen.getByLabelText("Label"), " New ");
    await user.click(screen.getByRole("button", { name: "Save label" }));
    expect(onSave).toHaveBeenCalledWith("New");
    expect(screen.getByRole("button", { name: "Save label" })).toBeDisabled();
    done();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Save label" })).toBeEnabled());
  });
});
