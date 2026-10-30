"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { TxContext, TxResult, TxStage } from "@/lib/data";
import { isDemo } from "@/lib/config";
import { explorer, network } from "@/lib/stellar/network";
import { useWallet } from "@/lib/wallet/wallet-provider";
import { WalletError } from "@/lib/wallet/types";
import { cn } from "@/lib/utils";
import { ContractError } from "@/lib/domain/types";
import { reportError } from "@/lib/telemetry";

export interface TxRequest<T> {
  title: string;
  description?: string;
  /** Rendered in the review step. Should state exactly what will happen on-chain. */
  summary?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Query keys to refresh after confirmation. Defaults to the whole treasury. */
  treasuryId?: string;
  successMessage?: string;
  action: (ctx: TxContext) => Promise<TxResult<T>>;
  onSuccess?: (result: TxResult<T>) => void;
}

type Phase = "review" | "running" | "success" | "error";

interface TxContextValue {
  run: <T>(req: TxRequest<T>) => void;
}

const Ctx = createContext<TxContextValue | null>(null);

const STAGES: { id: TxStage; label: string }[] = [
  { id: "building", label: "Building transaction" },
  { id: "simulating", label: "Simulating against current contract state" },
  { id: "signing", label: "Waiting for your wallet signature" },
  { id: "submitting", label: `Submitting to ${isDemo ? "demo network" : network.label}` },
  { id: "confirming", label: "Waiting for ledger confirmation" },
];

function friendlyError(e: unknown): string {
  if (e instanceof WalletError && e.code === "rejected") return "You rejected the request in your wallet.";
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

export function TxProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { address, sign } = useWallet();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [req, setReq] = useState<TxRequest<any> | null>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("review");
  const [stage, setStage] = useState<TxStage>("building");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TxResult<unknown> | null>(null);
  const running = useRef(false);

  const run = useCallback(<T,>(r: TxRequest<T>) => {
    setReq(r);
    setPhase("review");
    setStage("building");
    setError(null);
    setResult(null);
    setOpen(true);
  }, []);

  const execute = async () => {
    if (!req || running.current) return;
    if (!address) {
      setError("Connect a wallet first.");
      setPhase("error");
      return;
    }
    running.current = true;
    setPhase("running");
    setError(null);
    try {
      const res = await req.action({ source: address, sign, onStage: setStage });
      setResult(res);
      setPhase("success");
      await queryClient.invalidateQueries({ queryKey: req.treasuryId ? ["treasury", req.treasuryId] : ["treasury"] });
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      toast.success(req.successMessage ?? `${req.title} confirmed`, {
        description: `Ledger ${res.ledger.toLocaleString()}`,
      });
      req.onSuccess?.(res);
    } catch (e) {
      // Contract rejections and wallet rejections are expected outcomes, not bugs.
      if (!(e instanceof ContractError) && !(e instanceof WalletError)) reportError(e, "tx");
      setError(friendlyError(e));
      setPhase("error");
    } finally {
      running.current = false;
    }
  };

  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <Ctx.Provider value={{ run }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          // Don't allow closing mid-flight; the tx may already be submitted.
          if (!o && phase === "running") return;
          setOpen(o);
        }}
      >
        <DialogContent
          showCloseButton={phase !== "running"}
          onEscapeKeyDown={(e) => phase === "running" && e.preventDefault()}
          onInteractOutside={(e) => phase === "running" && e.preventDefault()}
          className="sm:max-w-lg"
        >
          {req && (
            <>
              <DialogHeader>
                <DialogTitle>{req.title}</DialogTitle>
                {req.description && <DialogDescription>{req.description}</DialogDescription>}
              </DialogHeader>

              {phase === "review" && (
                <div className="space-y-4">
                  {req.summary}
                  <p className="text-muted-foreground flex items-start gap-2 text-xs">
                    <ShieldCheck className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                    The contract re-checks every policy rule before anything changes. If a rule fails, the simulation
                    stops here and nothing is signed.
                  </p>
                </div>
              )}

              {phase === "running" && (
                <ol className="space-y-3" aria-live="polite" aria-label="Transaction progress">
                  {STAGES.map((s, i) => {
                    const done = i < stageIndex;
                    const active = i === stageIndex;
                    return (
                      <li key={s.id} className="flex items-center gap-3 text-sm">
                        <span
                          className={cn(
                            "flex size-6 items-center justify-center rounded-full border text-xs",
                            done && "border-success bg-success/10 text-success",
                            active && "border-primary text-primary",
                            !done && !active && "text-muted-foreground",
                          )}
                          aria-hidden
                        >
                          {done ? (
                            <CheckCircle2 className="size-4" />
                          ) : active ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            i + 1
                          )}
                        </span>
                        <span className={cn(!done && !active && "text-muted-foreground", active && "font-medium")}>
                          {s.label}
                          <span className="sr-only">{done ? " (done)" : active ? " (in progress)" : ""}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}

              {phase === "success" && result && (
                <div className="flex flex-col items-center gap-3 py-2 text-center" role="status">
                  <CheckCircle2 className="text-success size-10" aria-hidden />
                  <div>
                    <p className="font-medium">Confirmed in ledger {result.ledger.toLocaleString()}</p>
                    <p className="text-muted-foreground mt-1 font-mono text-xs break-all">{result.hash}</p>
                  </div>
                  {!isDemo && (
                    <a
                      href={explorer.tx(result.hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                    >
                      View on Stellar Expert <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                </div>
              )}

              {phase === "error" && (
                <Alert variant="destructive">
                  <CircleAlert aria-hidden />
                  <AlertTitle>Transaction not completed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                {phase === "review" && (
                  <>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant={req.destructive ? "destructive" : "default"} onClick={execute} autoFocus>
                      {req.confirmLabel}
                    </Button>
                  </>
                )}
                {phase === "running" && (
                  <Button disabled>
                    <Loader2 className="animate-spin" aria-hidden /> Working…
                  </Button>
                )}
                {phase === "success" && <Button onClick={() => setOpen(false)}>Done</Button>}
                {phase === "error" && (
                  <>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={execute}>Try again</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useTx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTx must be used inside <TxProvider>");
  return ctx.run;
}
