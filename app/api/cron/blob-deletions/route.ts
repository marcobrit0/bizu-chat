import { drainAllPendingBlobDeletions } from "@/lib/blob-delete";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (
    process.env.CRON_SECRET &&
    authorization === `Bearer ${process.env.CRON_SECRET}`
  ) {
    const deletedCount = await drainAllPendingBlobDeletions();

    return Response.json({ deletedCount });
  }

  return new Response("Unauthorized", { status: 401 });
}
