import {
  drainAllPendingBlobDeletions,
  resumePendingChatErasures,
  resumePendingDataErasures,
} from "@/lib/blob-delete";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (
    process.env.CRON_SECRET &&
    authorization === `Bearer ${process.env.CRON_SECRET}`
  ) {
    const resumedCount = await resumePendingDataErasures();
    const resumedChatCount = await resumePendingChatErasures();
    const deletedCount = await drainAllPendingBlobDeletions();

    return Response.json({ deletedCount, resumedChatCount, resumedCount });
  }

  return new Response("Unauthorized", { status: 401 });
}
