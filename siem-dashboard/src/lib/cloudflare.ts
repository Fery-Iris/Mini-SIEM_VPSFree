export async function blockIpInCloudflare(ipAddress: string, reason: string) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  if (!token || !accountId) return false;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/firewall/access_rules/rules`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "block",
          configuration: {
            target: "ip",
            value: ipAddress
          },
          notes: `[Mini-SIEM] ${reason}`
        })
      }
    );

    const data = await response.json();
    return data.success;
  } catch (error) {
    return false;
  }
}

export async function unblockIpInCloudflare(ipAddress: string) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  if (!token || !accountId) return false;

  try {
    // 1. Find the rule ID for this IP
    const searchRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/firewall/access_rules/rules?configuration.value=${ipAddress}&mode=block`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    const searchData = await searchRes.json();
    
    if (!searchData.success || searchData.result.length === 0) {
      return true; // Already unblocked or not found
    }

    const ruleId = searchData.result[0].id;

    // 2. Delete the rule
    const delRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/firewall/access_rules/rules/${ruleId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
    
    const delData = await delRes.json();
    return delData.success;
  } catch (error) {
    console.error("[Cloudflare] Unblock error:", error);
    return false;
  }
}

