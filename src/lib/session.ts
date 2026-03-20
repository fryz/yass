import { sealData, unsealData } from "iron-session";

export interface AttendeeSession {
  email: string;
  verified: boolean;
  eventId: string;
}

const SEAL_KEY = process.env.SESSION_SECRET!;

export async function sealSession(data: AttendeeSession): Promise<string> {
  return sealData(data, { password: SEAL_KEY, ttl: 3600 });
}

export async function unsealSession(
  cookie: string
): Promise<AttendeeSession | null> {
  try {
    const data = await unsealData<AttendeeSession>(cookie, {
      password: SEAL_KEY,
    });
    if (!data?.email || !data?.verified) return null;
    return data;
  } catch {
    return null;
  }
}
