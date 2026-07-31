import { headers } from "next/headers";
import jwt from "jsonwebtoken";

export async function getAdminId(): Promise<number | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "xr-security-change-me-in-production";
    const decoded = jwt.verify(token, secret) as { adminId: number };
    return decoded.adminId;
  } catch (error) {
    return null;
  }
}
