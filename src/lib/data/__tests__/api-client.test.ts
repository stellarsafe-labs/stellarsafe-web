import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../live/api-client";
import { getSession, setSession } from "../live/session";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setSession(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("api client", () => {
  it("validates and converts responses (amount strings → bigint)", async () => {
    fetchMock.mockResolvedValue(
      json({
        items: [
          {
            id: "C1",
            name: "T",
            roles: ["admin"],
            memberCount: 2,
            pendingCount: 0,
            managedAssetCode: "USDC",
            balance: "200000000",
          },
        ],
      }),
    );
    const [t] = await api.listTreasuries("GABC");
    expect(t.balance).toBe(200_000_000n);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.stellarsafe.test/treasuries?member=GABC");
  });

  it("rejects malformed responses instead of rendering them", async () => {
    fetchMock.mockResolvedValue(json({ items: [{ id: "C1", name: 5 }] }));
    await expect(api.listTreasuries("G")).rejects.toMatchObject({
      status: 500,
      message: expect.stringMatching(/Unexpected API response/),
    });
  });

  it("requires a session for authenticated calls and sends it as a bearer token", async () => {
    await expect(api.getPreferences("C1")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();

    setSession({ address: "GABC", token: "jwt", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValue(
      json({ events: { approvalRequested: true, proposalExecuted: false, policyChanged: true, memberChanged: false } }),
    );
    await api.getPreferences("C1");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer jwt");
  });

  it("clears the session on 401 and surfaces the server message", async () => {
    setSession({ address: "GABC", token: "jwt", expiresAt: Date.now() + 60_000 });
    fetchMock.mockResolvedValue(json({ message: "Token expired" }, 401));
    await expect(api.getPreferences("C1")).rejects.toMatchObject({ status: 401, message: "Token expired" });
    expect(getSession()).toBeNull();
  });

  it("reports network failures clearly", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
    await expect(api.health()).rejects.toMatchObject({ status: 0 });
  });

  it("ignores expired sessions and sessions for another address", () => {
    setSession({ address: "GABC", token: "t", expiresAt: Date.now() - 1 });
    expect(getSession()).toBeNull();
    setSession({ address: "GABC", token: "t", expiresAt: Date.now() + 1000 });
    expect(getSession("GXYZ")).toBeNull();
    expect(getSession("GABC")?.token).toBe("t");
  });
});
