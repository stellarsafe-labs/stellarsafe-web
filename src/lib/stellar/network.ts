import { Networks } from "@stellar/stellar-sdk";
import { config, type NetworkName } from "@/lib/config";

interface NetworkInfo {
  name: NetworkName;
  label: string;
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  explorerUrl: string;
}

const NETWORKS: Record<NetworkName, NetworkInfo> = {
  testnet: {
    name: "testnet",
    label: "Testnet",
    passphrase: Networks.TESTNET,
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
  futurenet: {
    name: "futurenet",
    label: "Futurenet",
    passphrase: Networks.FUTURENET,
    rpcUrl: "https://rpc-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/futurenet",
  },
  mainnet: {
    name: "mainnet",
    label: "Mainnet",
    passphrase: Networks.PUBLIC,
    rpcUrl: "https://mainnet.sorobanrpc.com",
    horizonUrl: "https://horizon.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/public",
  },
};

const base = NETWORKS[config.network];

export const network: NetworkInfo = {
  ...base,
  rpcUrl: config.rpcUrl ?? base.rpcUrl,
  horizonUrl: config.horizonUrl ?? base.horizonUrl,
};

export const explorer = {
  tx: (hash: string) => `${network.explorerUrl}/tx/${hash}`,
  account: (address: string) =>
    address.startsWith("C")
      ? `${network.explorerUrl}/contract/${address}`
      : `${network.explorerUrl}/account/${address}`,
  ledger: (seq: number) => `${network.explorerUrl}/ledger/${seq}`,
};
