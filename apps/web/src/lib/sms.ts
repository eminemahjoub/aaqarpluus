export type { SendSMSParams, SendSMSResult } from "./sms/types";
export { SMSProvider } from "./sms/types";
export { isSMSRetryable, normalizeSaudiNumber } from "./sms/utils";
export { UnifonicProvider } from "./sms/unifonic";

export function getSMSProvider(): SMSProvider {
  const provider = process.env.SMS_PROVIDER;
  if (provider === "unifonic") {
    return new UnifonicProvider();
  }
  throw new Error(`Unknown SMS provider: ${provider}`);
}