import {
  ss58Decode,
  ss58Encode,
  mnemonicToEntropy,
  blake2b256,
  mnemonicToMiniSecret,
  DEV_PHRASE,
} from "@polkadot-labs/hdkd-helpers";
import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import { p256 } from "@noble/curves/nist.js";
import {
  cryptoWaitReady,
  sr25519PairFromSeed,
  blake2AsU8a,
} from "@polkadot/util-crypto";
import { stringToU8a } from "@polkadot/util";
import { member_from_entropy, sign } from "verifiablejs/bundler";
import {
  checkUsernameOnChain,
  checkUsernamesOnChain,
  registerUserOnPreview,
  checkLitePersonExists,
  type AttestationParams,
} from "./blockchainClient";

const REGISTER_SIGNATURE_MESSAGE_PREFIX = "pop:people-lite:register using";
const DERIVATION_PATH_CANDIDATE = "//wallet";

// Alice is the verifier on local dev chains
const aliceMiniSecret = mnemonicToMiniSecret(DEV_PHRASE, "");
const aliceDerive = sr25519CreateDerive(aliceMiniSecret);
const aliceWallet = aliceDerive("//Alice");
const VERIFIER_ADDRESS = ss58Encode(aliceWallet.publicKey, 42);

export interface RegisterUsernameParametersRaw {
  username: string;
  candidateAccountId: string;
  candidatePublicKey: Uint8Array;
  candidateSignature: Uint8Array;
  ringVrfKey: Uint8Array;
  proofOfOwnership: Uint8Array;
  identifierKey: Uint8Array;
  consumerRegistrationSignature: Uint8Array;
}

export interface UsernameResponse {
  base_username: string;
  digits: string;
  username: string;
  txHash?: string;
}

export interface UsernameAvailability {
  [username: string]: "AVAILABLE" | "TAKEN" | "INVALID";
}

export interface UsernameSearchResult {
  username: string;
  candidateAccountId: string;
  status?: string;
}

/**
 * Derives the identifierKey (chatPublicKey) from a BIP39 mnemonic
 */
async function deriveIdentifierKey(
  mnemonic: string,
  derivationPath: string = "//wallet//chat"
): Promise<Uint8Array> {
  await cryptoWaitReady();

  const miniSecret = mnemonicToMiniSecret(mnemonic, "");
  const pair = sr25519PairFromSeed(miniSecret);

  const pathComponents = derivationPath.split("//").filter((p) => p.length > 0);

  let derivedPair = pair;
  for (const component of pathComponents) {
    const chainCode = stringToU8a(component);
    const combined = new Uint8Array(
      derivedPair.secretKey.length + chainCode.length
    );
    combined.set(derivedPair.secretKey);
    combined.set(chainCode, derivedPair.secretKey.length);

    const newSecret = blake2AsU8a(combined, 512);
    derivedPair = sr25519PairFromSeed(newSecret.slice(0, 32));
  }

  const p256PrivateKeyBytes = blake2AsU8a(derivedPair.secretKey, 256);
  const p256PublicKey = p256.getPublicKey(p256PrivateKeyBytes, false);

  return p256PublicKey;
}

/**
 * Derives all parameters needed for username registration (raw Uint8Arrays)
 */
export async function deriveAttestationParamsRaw(
  mnemonic: string,
  username: string,
  verifierAddress: string = VERIFIER_ADDRESS
): Promise<RegisterUsernameParametersRaw> {
  const entropy = mnemonicToEntropy(mnemonic);
  const miniSecret = mnemonicToMiniSecret(mnemonic, "");
  const derive = sr25519CreateDerive(miniSecret);
  const verifiableEntropy = blake2b256(entropy);

  const candidateWallet = derive(DERIVATION_PATH_CANDIDATE);
  const candidatePublicKey = candidateWallet.publicKey;

  // 1. ringVrfKey - using verifiable entropy (Bandersnatch key)
  const ringVrfKey = member_from_entropy(verifiableEntropy);

  // 2. identifierKey - P256 public key derived from mnemonic
  const identifierKey = await deriveIdentifierKey(mnemonic);

  // 3. Build message: prefix + candidate account + ringVrfKey
  const message = new Uint8Array([
    ...new TextEncoder().encode(REGISTER_SIGNATURE_MESSAGE_PREFIX),
    ...candidatePublicKey,
    ...ringVrfKey,
  ]);

  // 4. candidateSignature: candidate signs the message with SR25519
  const candidateSignature = candidateWallet.sign(message);

  // 5. proofOfOwnership: Bandersnatch ring signature using verifiable entropy
  const proofOfOwnership = sign(verifiableEntropy, message);

  // 6. consumerRegistrationSignature
  const [verifierAccountId] = ss58Decode(verifierAddress);
  const usernameWithoutDigits = username.split(".")[0] || username;
  const usernameBytes = new TextEncoder().encode(usernameWithoutDigits);
  const usernameLength = usernameBytes.length;
  const usernameCompactLength = (usernameLength << 2) | 0b00;

  const resourcesSignatureData = new Uint8Array([
    ...candidatePublicKey,
    ...verifierAccountId,
    ...identifierKey,
    usernameCompactLength,
    ...usernameBytes,
    0x00,
  ]);

  const consumerRegistrationSignature = candidateWallet.sign(
    resourcesSignatureData
  );

  // 7. candidateAccountId - SS58 encoded address
  const candidateAccountId = ss58Encode(candidatePublicKey, 42);

  return {
    username: usernameWithoutDigits,
    candidateAccountId,
    candidatePublicKey,
    candidateSignature,
    ringVrfKey,
    proofOfOwnership,
    identifierKey,
    consumerRegistrationSignature,
  };
}

/**
 * Generate random digits suffix for username
 */
function generateRandomDigits(length: number = 8): string {
  let digits = "";
  for (let i = 0; i < length; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return digits;
}

/**
 * Register username via direct blockchain call
 * Uses Alice as the verifier to attest the user and grants statement allowance
 */
export async function registerUsername(
  mnemonic: string,
  username: string
): Promise<UsernameResponse> {
  const digits = generateRandomDigits(2);
  const fullUsername = `${username}.${digits}`;

  const rawParams = await deriveAttestationParamsRaw(mnemonic, fullUsername, VERIFIER_ADDRESS);

  const attestationParams: AttestationParams = {
    candidateAccountId: rawParams.candidateAccountId,
    candidateSignature: rawParams.candidateSignature,
    ringVrfKey: rawParams.ringVrfKey,
    proofOfOwnership: rawParams.proofOfOwnership,
    identifierKey: rawParams.identifierKey,
    consumerRegistrationSignature: rawParams.consumerRegistrationSignature,
    username: fullUsername,
  };

  const { txHash } = await registerUserOnPreview(attestationParams, rawParams.candidatePublicKey);

  return {
    base_username: rawParams.username,
    digits,
    username: fullUsername,
    txHash,
  };
}

/**
 * Check username availability via direct blockchain call
 */
export async function checkUsernameAvailability(
  usernames: string[]
): Promise<UsernameAvailability> {
  return checkUsernamesOnChain(usernames);
}

/**
 * Poll for username registration completion via direct blockchain call
 */
export async function pollForRegistration(
  username: string,
  candidateAccountId: string,
  maxAttempts: number = 60
): Promise<UsernameSearchResult> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        reject(
          new Error(
            `Username registration polling timeout after ${maxAttempts} attempts`
          )
        );
        return;
      }

      try {
        const exists = await checkLitePersonExists(candidateAccountId);

        if (exists) {
          resolve({
            username,
            candidateAccountId,
            status: "ASSIGNED",
          });
          return;
        }
      } catch (error) {
        console.error("Polling request failed:", error);
      }

      setTimeout(poll, 2000);
    };

    poll();
  });
}

/**
 * Username validation regex (7+ lowercase letters)
 */
export const USERNAME_REGEX = /^([a-z]{7,})$/;

/**
 * Validate username format
 */
export function validateUsername(username: string): {
  valid: boolean;
  error?: string;
} {
  if (!username) {
    return { valid: false, error: "Username is required" };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error: "Username must be at least 7 lowercase letters (a-z)",
    };
  }

  return { valid: true };
}
