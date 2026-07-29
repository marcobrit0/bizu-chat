import { auth } from "@/app/(auth)/auth";
import {
  drainPendingBlobDeletions,
  getAllUserBlobUrls,
} from "@/lib/blob-delete";
import { deleteUserById, markUserForDeletion } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function DELETE() {
  const session = await auth();

  if (session?.user) {
    await markUserForDeletion({ id: session.user.id });
    await drainPendingBlobDeletions(session.user.id);
    const blobUrls = await getAllUserBlobUrls(session.user.id);
    await deleteUserById({ blobUrls, id: session.user.id });
    await drainPendingBlobDeletions(session.user.id);

    return new Response(null, { status: 204 });
  }

  return new ChatbotError("unauthorized:auth").toResponse();
}
