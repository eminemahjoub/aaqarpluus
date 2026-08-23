export const zatcaConfig = {
  csid: process.env.ZATCA_CSID,
  csidSecret: process.env.ZATCA_CSID_SECRET,
  privateKeyPath: process.env.ZATCA_PRIVATE_KEY_PATH,
  apiBase: process.env.ZATCA_API_BASE || "https://api.zatca.gov.sa",
  complianceEndpoint: process.env.ZATCA_COMPLIANCE_ENDPOINT || "/core/compliance/invoices",
  productionEndpoint: process.env.ZATCA_PRODUCTION_ENDPOINT || "/core/production/invoices",
  otp: process.env.ZATCA_OTP,
};