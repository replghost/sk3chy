/**
 * Blockchain client for People chain (Preview Network)
 *
 * Uses polkadot-api with the preview descriptor for:
 * - Username availability checks
 * - User registration via attestation
 *
 * Note: Preview network uses custom signed extensions (VerifyMultiSignature, AsPerson)
 */

import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPolkadotSigner, type PolkadotSigner } from "polkadot-api/signer";
import { Binary } from "polkadot-api";
import { preview } from "@polkadot-api/descriptors";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import {
  DEV_PHRASE,
  mnemonicToMiniSecret,
  ss58Encode,
  ss58Decode,
} from "@polkadot-labs/hdkd-helpers";
import { xxhashAsU8a, blake2AsU8a } from "@polkadot/util-crypto";

// Default endpoint — overridden via setEndpoint()
let PREVIEW_ENDPOINT = "wss://previewnet.substrate.dev/people";

// Verifier address (Alice on dev/preview chains)
const VERIFIER_ADDRESS = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

// Singleton client instance
let clientInstance: ReturnType<typeof createClient> | null = null;
let apiInstance: ReturnType<
  ReturnType<typeof createClient>["getTypedApi"]
> | null = null;

/**
 * Set the WebSocket endpoint (call before first use)
 */
export function setEndpoint(endpoint: string) {
  if (clientInstance) {
    disconnectBlockchainClient();
  }
  PREVIEW_ENDPOINT = endpoint;
}

/**
 * Probe if the WebSocket endpoint is reachable (quick connectivity check)
 */
function probeWs(url: string, timeoutMs: number = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket probe timeout"));
    }, timeoutMs);
    ws.onopen = () => {
      clearTimeout(timer);
      ws.close();
      resolve();
    };
    ws.onerror = () => {
      clearTimeout(timer);
      ws.close();
      reject(new Error("WebSocket probe failed"));
    };
  });
}

/**
 * Get or create a blockchain client connection.
 * Probes the endpoint first to avoid runaway reconnection loops.
 */
export async function getBlockchainClient() {
  if (clientInstance && apiInstance) {
    return { client: clientInstance, api: apiInstance };
  }

  // Probe first — fast fail if chain is unreachable
  await probeWs(PREVIEW_ENDPOINT);

  const provider = getWsProvider(PREVIEW_ENDPOINT);
  clientInstance = createClient(provider);
  apiInstance = clientInstance.getTypedApi(preview);

  return { client: clientInstance, api: apiInstance };
}

/**
 * Disconnect the blockchain client
 */
export function disconnectBlockchainClient(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
    apiInstance = null;
  }
}

// ============================================================================
// People Chain Signer (with custom signed extensions)
// ============================================================================

interface KeyPair {
  publicKey: Uint8Array;
  sign: (message: Uint8Array) => Uint8Array;
}

/**
 * Creates a Polkadot signer with People chain-specific signed extensions
 */
function createPeopleSigner(keyPair: KeyPair): PolkadotSigner {
  const baseSigner = getPolkadotSigner(
    keyPair.publicKey,
    "Sr25519",
    keyPair.sign
  );

  return {
    publicKey: baseSigner.publicKey,
    signBytes: baseSigner.signBytes,
    signTx: async (
      callData,
      signedExtensions,
      metadata,
      atBlockNumber,
      hasher
    ) => {
      const extensionsWithCustom = {
        ...signedExtensions,
        VerifyMultiSignature: {
          identifier: "VerifyMultiSignature",
          value: new Uint8Array([1]),
          additionalSigned: new Uint8Array([]),
        },
        AsPerson: {
          identifier: "AsPerson",
          value: new Uint8Array([0]),
          additionalSigned: new Uint8Array([]),
        },
      };

      return baseSigner.signTx(
        callData,
        extensionsWithCustom,
        metadata,
        atBlockNumber,
        hasher
      );
    },
  };
}

/**
 * Create a signer for Alice (verifier account)
 */
export function createAliceSigner(): PolkadotSigner {
  const miniSecret = mnemonicToMiniSecret(DEV_PHRASE, "");
  const derive = sr25519CreateDerive(miniSecret);
  const aliceWallet = derive("//Alice");

  return createPeopleSigner(aliceWallet);
}

/**
 * Get Alice's address
 */
function getAliceAddress(): string {
  const miniSecret = mnemonicToMiniSecret(DEV_PHRASE, "");
  const derive = sr25519CreateDerive(miniSecret);
  const aliceWallet = derive("//Alice");
  return ss58Encode(aliceWallet.publicKey);
}

// ============================================================================
// Username Queries
// ============================================================================

/**
 * Get username length requirements from chain constants
 */
export async function getUsernameRequirements(): Promise<{ min: number; max: number }> {
  const { api } = await getBlockchainClient();
  const min = await api.constants.Resources.MinUsernameLength();
  const max = await api.constants.Resources.MaxUsernameLength();
  return { min, max };
}

export type UsernameStatus = "AVAILABLE" | "TAKEN" | "INVALID";

/**
 * Check if a username is available on the blockchain
 */
export async function checkUsernameOnChain(
  username: string
): Promise<UsernameStatus> {
  if (!/^[a-z]{7,}$/.test(username)) {
    return "INVALID";
  }

  const { api } = await getBlockchainClient();
  const usernameBytes = Binary.fromText(username);
  const result = await api.query.Identity.UsernameInfoOf.getValue(usernameBytes);

  if (result === undefined || result === null) {
    return "AVAILABLE";
  }
  return "TAKEN";
}

/**
 * Check multiple usernames for availability
 */
export async function checkUsernamesOnChain(
  usernames: string[]
): Promise<Record<string, UsernameStatus>> {
  const results: Record<string, UsernameStatus> = {};

  await Promise.all(
    usernames.map(async (username) => {
      results[username] = await checkUsernameOnChain(username);
    })
  );

  return results;
}

/**
 * Check if a LitePerson exists for a given account ID
 */
export async function checkLitePersonExists(
  accountId: string
): Promise<boolean> {
  try {
    const { api } = await getBlockchainClient();
    const result = await api.query.PeopleLite.LitePeople.getValue(accountId);
    return result !== undefined && result !== null;
  } catch (error) {
    console.error("Error checking lite person on chain:", error);
    return false;
  }
}

// ============================================================================
// Registration & Attestation
// ============================================================================

export interface AttestationParams {
  candidateAccountId: string;
  candidateSignature: Uint8Array;
  ringVrfKey: Uint8Array;
  proofOfOwnership: Uint8Array;
  identifierKey: Uint8Array;
  consumerRegistrationSignature: Uint8Array;
  username: string;
}

export interface RegistrationProgressUpdate {
  stage:
    | "preflight"
    | "attestation_allowance"
    | "attestation_submitting"
    | "statement_allowance_submitting"
    | "done";
  label: string;
  percent: number;
  etaSeconds?: number;
  detail?: string;
}

interface RegistrationProgressOptions {
  onProgress?: (progress: RegistrationProgressUpdate) => void;
}

function emitProgress(
  options: RegistrationProgressOptions | undefined,
  progress: RegistrationProgressUpdate
) {
  options?.onProgress?.(progress);
}

/**
 * Register a LitePerson via attestation using Alice as the verifier
 */
export async function registerLitePerson(
  params: AttestationParams,
  options?: RegistrationProgressOptions
): Promise<string> {
  const { api } = await getBlockchainClient();
  const aliceSigner = createAliceSigner();

  console.log("Registering LitePerson:", params.candidateAccountId);
  console.log("Username:", params.username);

  const existingLitePerson = await api.query.PeopleLite.LitePeople.getValue(
    params.candidateAccountId
  );

  if (existingLitePerson !== undefined) {
    console.log("User already registered");
    return "already_registered";
  }

  const attestCall = api.tx.PeopleLite.attest({
    candidate: params.candidateAccountId,
    candidate_signature: {
      type: "Sr25519",
      value: Binary.fromBytes(params.candidateSignature),
    },
    ring_vrf_key: Binary.fromBytes(params.ringVrfKey),
    proof_of_ownership: Binary.fromBytes(params.proofOfOwnership),
    consumer_registration: {
      signature: {
        type: "Sr25519",
        value: Binary.fromBytes(params.consumerRegistrationSignature),
      },
      account: params.candidateAccountId,
      identifier_key: Binary.fromBytes(params.identifierKey),
      username: Binary.fromText(params.username),
      reserved_username: undefined,
    },
  });

  const txHash = await new Promise<string>((resolve, reject) => {
    const subscription = attestCall.signSubmitAndWatch(aliceSigner).subscribe({
      next: (event: any) => {
        console.log("Attestation event:", event.type);
        if (event.type === "signed") {
          emitProgress(options, {
            stage: "attestation_submitting",
            label: "Attestation signed, submitting to chain...",
            percent: 28,
            etaSeconds: 35,
          });
        } else if (event.type === "broadcasted") {
          emitProgress(options, {
            stage: "attestation_submitting",
            label: "Attestation broadcasted, waiting for inclusion...",
            percent: 38,
            etaSeconds: 25,
          });
        } else if (event.type === "txBestBlocksState") {
          emitProgress(options, {
            stage: "attestation_submitting",
            label: "Attestation included, waiting finalization...",
            percent: 50,
            etaSeconds: 15,
          });
        }

        if (event.type === "finalized") {
          if (event.ok) {
            console.log("Attestation successful, tx hash:", event.txHash);
            emitProgress(options, {
              stage: "attestation_submitting",
              label: "Attestation finalized",
              percent: 62,
              etaSeconds: 12,
            });
            subscription.unsubscribe();
            resolve(event.txHash);
          } else {
            console.error("Attestation failed:", event.dispatchError);
            let errorMessage = "Attestation failed";
            if (event.dispatchError?.type === "Module") {
              const moduleError = event.dispatchError.value;
              errorMessage = `${moduleError.type}.${moduleError.value?.type || "Unknown"}`;
            }
            subscription.unsubscribe();
            reject(new Error(errorMessage));
          }
        }
      },
      error: (error: any) => {
        console.error("Attestation error:", error);
        subscription.unsubscribe();
        reject(error);
      },
    });
  });

  return txHash;
}

/**
 * Check verifier's attestation allowance
 */
export async function checkAttestationAllowance(): Promise<number> {
  const { api } = await getBlockchainClient();
  const aliceAddress = getAliceAddress();

  const allowance =
    await api.query.PeopleLite.AttestationAllowance.getValue(aliceAddress);
  return allowance ?? 0;
}

/**
 * Build storage key for PeopleLite.AttestationAllowance
 */
function buildAttestationAllowanceStorageKey(accountId: Uint8Array): Uint8Array {
  const palletHash = xxhashAsU8a("PeopleLite", 128);
  const storageHash = xxhashAsU8a("AttestationAllowance", 128);
  const accountHash = blake2AsU8a(accountId, 128);

  const key = new Uint8Array(16 + 16 + 16 + 32);
  key.set(palletHash, 0);
  key.set(storageHash, 16);
  key.set(accountHash, 32);
  key.set(accountId, 48);

  return key;
}

/**
 * Grant attestation allowance to Alice via sudo
 */
export async function grantAttestationAllowanceViaSudo(allowance: number = 1000): Promise<string> {
  const { api } = await getBlockchainClient();
  const aliceSigner = createAliceSigner();
  const aliceAddress = getAliceAddress();

  console.log("Granting attestation allowance to Alice:", aliceAddress);

  const [aliceAccountId] = ss58Decode(aliceAddress);

  const storageKey = buildAttestationAllowanceStorageKey(aliceAccountId);

  const allowanceBytes = new Uint8Array(4);
  new DataView(allowanceBytes.buffer).setUint32(0, allowance, true);

  const setStorageCall = api.tx.System.set_storage({
    items: [[Binary.fromBytes(storageKey), Binary.fromBytes(allowanceBytes)]],
  });

  const sudoCall = api.tx.Sudo.sudo({ call: setStorageCall.decodedCall });

  const txHash = await new Promise<string>((resolve, reject) => {
    const subscription = sudoCall.signSubmitAndWatch(aliceSigner).subscribe({
      next: (event: any) => {
        console.log("Sudo event:", event.type);

        if (event.type === "finalized") {
          if (event.ok) {
            console.log("Attestation allowance granted, tx hash:", event.txHash);
            subscription.unsubscribe();
            resolve(event.txHash);
          } else {
            console.error("Sudo failed:", event.dispatchError);
            subscription.unsubscribe();
            reject(new Error("Failed to grant attestation allowance via sudo"));
          }
        }
      },
      error: (error: any) => {
        console.error("Sudo error:", error);
        subscription.unsubscribe();
        reject(error);
      },
    });
  });

  return txHash;
}

// ============================================================================
// Combined Registration Flow
// ============================================================================

/**
 * Complete registration flow for preview network
 */
export async function registerUserOnPreview(
  params: AttestationParams,
  candidatePublicKey?: Uint8Array,
  options?: RegistrationProgressOptions
): Promise<{ txHash: string }> {
  emitProgress(options, {
    stage: "preflight",
    label: "Preparing registration...",
    percent: 8,
    etaSeconds: 55,
  });

  const requirements = await getUsernameRequirements();
  console.log("Username:", params.username, "length:", params.username.length);
  console.log("Requirements:", requirements);
  emitProgress(options, {
    stage: "preflight",
    label: "Checking chain requirements...",
    percent: 14,
    etaSeconds: 50,
  });

  emitProgress(options, {
    stage: "attestation_allowance",
    label: "Checking attestation allowance...",
    percent: 18,
    etaSeconds: 45,
  });
  let allowance = await checkAttestationAllowance();
  console.log("Current attestation allowance:", allowance);

  if (allowance === 0) {
    console.log("No attestation allowance, granting via sudo...");
    emitProgress(options, {
      stage: "attestation_allowance",
      label: "Granting attestation allowance...",
      percent: 24,
      etaSeconds: 40,
    });
    await grantAttestationAllowanceViaSudo(1000);
    allowance = await checkAttestationAllowance();
    console.log("New attestation allowance:", allowance);
  }

  emitProgress(options, {
    stage: "attestation_submitting",
    label: "Submitting attestation transaction...",
    percent: 26,
    etaSeconds: 35,
  });
  const txHash = await registerLitePerson(params, options);

  if (candidatePublicKey) {
    console.log("Granting statement store allowance to new user...");
    emitProgress(options, {
      stage: "statement_allowance_submitting",
      label: "Submitting statement allowance transaction...",
      percent: 66,
      etaSeconds: 12,
    });
    await grantStatementAllowanceViaSudo(candidatePublicKey, 10, 20480, options);
  }

  emitProgress(options, {
    stage: "done",
    label: "Registration complete",
    percent: 100,
    etaSeconds: 0,
  });

  return { txHash };
}

// ============================================================================
// Statement Store Allowance
// ============================================================================

/**
 * Build storage key for statement-store allowance
 */
function buildStatementAllowanceStorageKey(accountId: Uint8Array): Uint8Array {
  const prefix = new TextEncoder().encode(":statement-allowance:");
  const key = new Uint8Array(prefix.length + accountId.length);
  key.set(prefix, 0);
  key.set(accountId, prefix.length);
  return key;
}

/**
 * Grant statement store allowance to an account via sudo
 */
export async function grantStatementAllowanceViaSudo(
  accountId: Uint8Array,
  statementCount: number = 10,
  maxSizeBytes: number = 20480,
  options?: RegistrationProgressOptions
): Promise<string> {
  const { api } = await getBlockchainClient();
  const aliceSigner = createAliceSigner();

  console.log("Granting statement allowance via sudo...");

  const storageKey = buildStatementAllowanceStorageKey(accountId);

  const allowanceBytes = new Uint8Array(8);
  const view = new DataView(allowanceBytes.buffer);
  view.setUint32(0, statementCount, true);
  view.setUint32(4, maxSizeBytes, true);

  const setStorageCall = api.tx.System.set_storage({
    items: [[Binary.fromBytes(storageKey), Binary.fromBytes(allowanceBytes)]],
  });

  const sudoCall = api.tx.Sudo.sudo({ call: setStorageCall.decodedCall });

  const txHash = await new Promise<string>((resolve, reject) => {
    const subscription = sudoCall.signSubmitAndWatch(aliceSigner).subscribe({
      next: (event: any) => {
        console.log("Statement allowance sudo event:", event.type);
        if (event.type === "signed") {
          emitProgress(options, {
            stage: "statement_allowance_submitting",
            label: "Statement allowance signed, submitting...",
            percent: 74,
            etaSeconds: 10,
          });
        } else if (event.type === "broadcasted") {
          emitProgress(options, {
            stage: "statement_allowance_submitting",
            label: "Statement allowance broadcasted...",
            percent: 84,
            etaSeconds: 7,
          });
        } else if (event.type === "txBestBlocksState") {
          emitProgress(options, {
            stage: "statement_allowance_submitting",
            label: "Statement allowance included, finalizing...",
            percent: 94,
            etaSeconds: 4,
          });
        }

        if (event.type === "finalized") {
          if (event.ok) {
            console.log("Statement allowance granted, tx hash:", event.txHash);
            emitProgress(options, {
              stage: "statement_allowance_submitting",
              label: "Statement allowance finalized",
              percent: 100,
              etaSeconds: 0,
            });
            subscription.unsubscribe();
            resolve(event.txHash);
          } else {
            console.error("Statement allowance sudo failed:", event.dispatchError);
            subscription.unsubscribe();
            reject(new Error("Failed to grant statement allowance via sudo"));
          }
        }
      },
      error: (error: any) => {
        console.error("Statement allowance sudo error:", error);
        subscription.unsubscribe();
        reject(error);
      },
    });
  });

  return txHash;
}

export { VERIFIER_ADDRESS };
