export async function blockIpInCloudflare(ipAddress: string, reason: string) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  // If no credentials, gracefully skip
  if (!token || !accountId) {
    console.log("[Cloudflare] Skipped blocking IP", ipAddress, "- Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID in .env");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/rules/lists`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: `Mini-SIEM Block: ${ipAddress}`,
          description: reason,
          kind: "ip",
          item: [{ ip: ipAddress, comment: reason }]
        })
      }
    );

    const data = await response.json();
    if (!data.success) {
      console.error("[Cloudflare] Failed to block IP:", data.errors);
      return false;
    }

    console.log("[Cloudflare] Successfully blocked IP at edge level:", ipAddress);
    return true;
  } catch (error) {
    console.error("[Cloudflare] Exception during API call:", error);
    return false;
  }
}

