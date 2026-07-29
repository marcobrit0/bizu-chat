import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { drainPendingBlobDeletionsBestEffort } from "@/lib/blob-delete";
import { buildBlobKey } from "@/lib/blob-path";
import {
  deletePendingBlobDeletion,
  getUserById,
  queueBlobDeletion,
} from "@/lib/db/queries";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

export async function POST(request: Request) {
  const session = await auth();
  const currentUser = session?.user
    ? await getUserById({ id: session.user.id })
    : null;
  const initialChatDeletionGeneration =
    currentUser?.chatDeletionGeneration ?? null;

  if (
    !session?.user ||
    !currentUser ||
    currentUser.deletingAt ||
    currentUser.chatsDeletingAt
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.issues
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();
    const pathname = buildBlobKey(
      session.user.id,
      `${randomUUID()}-${filename}`
    );
    const [deletionIntent] = await queueBlobDeletion({
      urls: [pathname],
      userId: session.user.id,
    });

    try {
      const data = await put(pathname, fileBuffer, {
        access: "public",
        addRandomSuffix: false,
      });

      const userAfterUpload = await getUserById({ id: session.user.id });

      if (
        userAfterUpload &&
        !userAfterUpload.deletingAt &&
        !userAfterUpload.chatsDeletingAt &&
        userAfterUpload.chatDeletionGeneration === initialChatDeletionGeneration
      ) {
        await deletePendingBlobDeletion({ id: deletionIntent.id });

        return NextResponse.json(data);
      }

      await drainPendingBlobDeletionsBestEffort(session.user.id);

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } catch {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
