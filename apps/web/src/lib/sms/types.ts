export interface SendSMSParams {
  to: string;
  body: string;
}

export interface SendSMSResult {
  messageId: string;
  status: "sent" | "failed" | "queued";
}

export abstract class SMSProvider {
  abstract send(params: SendSMSParams): Promise<SendSMSResult>;
}