import { isDemo } from "@/lib/config";
import { DemoDataSource } from "./demo/demo-source";
import { LiveDataSource } from "./live/live-source";
import type { DataSource } from "./source";

let instance: DataSource | null = null;

/** Singleton data source for the browser. Chosen by NEXT_PUBLIC_DATA_SOURCE. */
export function getDataSource(): DataSource {
  instance ??= isDemo ? new DemoDataSource() : new LiveDataSource();
  return instance;
}

export function getDemoSource(): DemoDataSource | null {
  const ds = getDataSource();
  return ds instanceof DemoDataSource ? ds : null;
}

export type { DataSource, TxContext, TxResult, TxStage } from "./source";
