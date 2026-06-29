function req(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === "") {
    const hint =
      name === "CF_API_TOKEN"
        ? "ضع CF_API_TOKEN في apps/web/.env أو .env.local"
        : name === "CF_ACCOUNT_ID"
          ? "ضع CF_ACCOUNT_ID في apps/web/.env أو .env.local"
          : `ضع ${name} في env`;
    throw new Error(`[env] Missing required environment variable: ${name}. ${hint}`);
  }
  return String(v);
}

function opt(name) {
  const v = process.env[name];
  if (!v || String(v).trim() === "") return null;
  return String(v);
}

module.exports = {
  cfToken: opt("CF_API_TOKEN"),
  cfAccountId: opt("CF_ACCOUNT_ID"),
};

