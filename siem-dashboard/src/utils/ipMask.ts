// IP Masking Utility — Frontend Only
// Mengubah tampilan IP publik menjadi IP privat saat dirender di UI.
// Data asli di database TIDAK terpengaruh.

const IP_MASK_MAP: Record<string, string> = {
  "114.79.44.5": "192.168.56.101",
  "114.79.44.85": "192.168.56.101",
  "114.79.44.104": "192.168.56.101",
  "180.248.115.206": "192.168.56.101",
  "180.248.115.104": "192.168.56.101",
  // Tambahkan mapping lain jika diperlukan
};

/**
 * Menyamarkan IP untuk keperluan tampilan UI.
 * Jika IP tidak ada di mapping, dikembalikan apa adanya.
 */
export function maskIP(ip: string): string {
  return IP_MASK_MAP[ip] ?? ip;
}
