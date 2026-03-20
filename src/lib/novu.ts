import { Novu } from "@novu/api";

let _novu: Novu | null = null;

function getNovu(): Novu {
  if (!_novu) {
    _novu = new Novu({ secretKey: process.env.NOVU_SECRET_KEY ?? process.env.NOVU_API_KEY ?? "placeholder" });
  }
  return _novu;
}

export async function sendEmail(
  subscriberId: string,
  templateId: string,
  payload: Record<string, unknown>
) {
  try {
    await getNovu().trigger({
      workflowId: templateId,
      to: subscriberId,
      payload,
    });
  } catch (err) {
    console.error(`Novu send failed [${templateId}]:`, err);
    // Fire-and-forget: don't throw, log failure
  }
}
