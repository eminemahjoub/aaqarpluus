import { zatcaConfig } from "@/lib/env";

export interface ZATCASigningResult {
  signedXml: string;
  invoiceHash: string;
  qrCode: string;
  uuid: string;
}

export async function signInvoiceXml(_unsignedXml: string): Promise<ZATCASigningResult> {
  if (!zatcaConfig.csid || !zatcaConfig.privateKeyPath) {
    throw new Error("ZATCA CSID credentials not configured");
  }

  // TODO: Implement when credentials arrive
  // 1. Load private key from ZATCA_PRIVATE_KEY_PATH
  // 2. Canonicalize the XML (C14N) and compute the invoice hash (SHA-256)
  // 3. Sign the hash with the CSID private key (ECDSA — verify algorithm
  //    against the current ZATCA spec)
  // 4. Embed the signature in the XML (XAdES-EPES)
  // 5. Derive the QR TLV (tags 1-5) from the signed invoice data
  // 6. Return signedXml + invoiceHash (base64) + qrCode + uuid

  throw new Error("ZATCA signing not yet implemented — awaiting CSID credentials");
}