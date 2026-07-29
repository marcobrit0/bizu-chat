"use server";

import { auth } from "@/app/(auth)/auth";
import { getSuggestionsByDocumentId } from "@/lib/db/queries";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const session = await auth();

  if (session?.user?.id) {
    return await getSuggestionsByDocumentId({
      documentId,
      userId: session.user.id,
    });
  }

  return [];
}
