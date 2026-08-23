import { zatcaConfig } from "@/lib/env";

export interface ZATCASubmissionResult {
  status: "reported" | "warning" | "error";
  reportId: string | null;
  warnings: string[];
  errors: string[];
  rawResponse: unknown;
}

export async function submitToZatca(
  signedXml: string,
  invoiceHash: string,
  isCompliance: boolean = false
): Promise<ZATCASubmissionResult> {
  if (!zatcaConfig.csid) {
    throw new Error("ZATCA CSID not configured");
  }

  const endpoint = isCompliance ? zatcaConfig.complianceEndpoint : zatcaConfig.productionEndpoint;
  void invoiceHash;
  void endpoint; // referenced by the TODO implementation // used by the submission TODO

  // TODO: Implement when credentials arrive
  // 1. POST the signed XML to ${zatcaConfig.apiBase}${endpoint}
  //    with the CSID binary-security-token + digital-signature headers
  // 2. Handle 202 (accepted), 400 (validation), 401 (auth), 500 (server)
  // 3. Parse: validationResults, reportingStatus, clearedInvoice
  // 4. Map to { reported | warning | error } + reportId + warnings + errors
  // 5. Retryable failures (network/5xx) must be re-queued by the caller

  throw new Error("ZATCA submission not yet implemented — awaiting CSID credentials");
}