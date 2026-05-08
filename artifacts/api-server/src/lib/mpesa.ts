import { logger } from "./logger";

interface MpesaConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
}

const isPlaceholder = (v: string) =>
  !v || v.toUpperCase().includes("REPLACE") || v.includes("REPLACE_WITH_");

function deriveCallbackUrl(): string {
  const explicit = process.env["MPESA_CALLBACK_URL"] ?? "";
  if (explicit && !isPlaceholder(explicit)) {
    return explicit.trim();
  }
  const domains = (process.env["REPLIT_DOMAINS"] ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (domains.length > 0) {
    return `https://${domains[0]}/api/mpesa/callback`;
  }
  return "";
}

export function getMpesaConfig(): MpesaConfig | null {
  const env = (process.env["MPESA_ENVIRONMENT"] ?? "sandbox").toLowerCase();
  const consumerKey = process.env["MPESA_CONSUMER_KEY"] ?? "";
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"] ?? "";
  const shortcode = process.env["MPESA_SHORTCODE"] ?? "";
  const passkey = process.env["MPESA_PASSKEY"] ?? "";
  const callbackUrl =  "https://smartbuy-wu7b.onrender.com/api/mpesa/callback";

  if (
    isPlaceholder(consumerKey) ||
    isPlaceholder(consumerSecret) ||
    isPlaceholder(shortcode) ||
    isPlaceholder(passkey) ||
    !callbackUrl
  ) {
    return null;
  }

  if (callbackUrl.includes(".replit.dev") || callbackUrl.includes("localhost")) {
    logger.warn(
      { callbackUrl },
      "M-Pesa callback URL looks like a dev/local URL. Safaricom cannot reach it. Deploy the app or set MPESA_CALLBACK_URL to your production domain.",
    );
  }

  return {
    baseUrl:
      env === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackUrl,
  };
}

export function isMpesaConfigured(): boolean {
  return getMpesaConfig() !== null;
}

export function getEffectiveCallbackUrl(): string {
  return deriveCallbackUrl();
}

interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(cfg: MpesaConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${cfg.consumerKey}:${cfg.consumerSecret}`,
  ).toString("base64");

  const url = `${cfg.baseUrl}/oauth/v1/generate?grant_type=client_credentials`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daraja oauth failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as DarajaTokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: now + Number(data.expires_in ?? 3500) * 1000,
  };
  return data.access_token;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export interface StkPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
}

export interface StkPushResult {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function initiateStkPush(
  params: StkPushParams,
): Promise<StkPushResult> {
  const cfg = getMpesaConfig();
  if (!cfg) {
    throw new Error("M-Pesa is not configured");
  }

  const token = await getAccessToken(cfg);
  const ts = timestamp();
  const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${ts}`).toString(
    "base64",
  );

  const body = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: params.amount,
    PartyA: params.phoneNumber,
    PartyB: cfg.shortcode,
    PhoneNumber: params.phoneNumber,
    CallBackURL: cfg.callbackUrl,
    AccountReference: params.accountReference.slice(0, 12),
    TransactionDesc: params.transactionDesc.slice(0, 13),
  };

  const url = `${cfg.baseUrl}/mpesa/stkpush/v1/processrequest`;
  logger.info(
    {
      callbackUrl: cfg.callbackUrl,
      url,
      amount: params.amount,
      phone: params.phoneNumber,
      environment: process.env["MPESA_ENVIRONMENT"] ?? "sandbox",
    },
    "Initiating Daraja STK push",
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as StkPushResult;
  if (!res.ok) {
    logger.warn({ status: res.status, json, callbackUrl: cfg.callbackUrl }, "Daraja STK push HTTP error");
  } else {
    logger.info(
      {
        status: res.status,
        checkoutRequestId: json.CheckoutRequestID,
        responseCode: json.ResponseCode,
      },
      "Daraja STK push response",
    );
  }
  return json;
}

export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return `254${digits.slice(1)}`;
  }
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) {
    return `254${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("254")) {
    return digits;
  }
  if (digits.length === 13 && digits.startsWith("2540")) {
    return `254${digits.slice(4)}`;
  }
  return null;
}

export function generateOrderReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DUKA-${ts}-${rnd}`;
}
