import { auth } from "@/app/(auth)/auth";
import { deleteAllUserBlobs } from "@/lib/blob-delete";
import { deleteUserById } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function DELETE() {
  const session = await auth();

  if (session?.user) {
    await deleteAllUserBlobs(session.user.id);
    const deletedUser = await deleteUserById({ id: session.user.id });

    if (deletedUser) {
      return new Response(null, { status: 204 });
    }

    return new ChatbotError("not_found:auth").toResponse();
  }

  return new ChatbotError("unauthorized:auth").toResponse();
}
