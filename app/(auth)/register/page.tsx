"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { messages as ui } from "@/lib/i18n/messages";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ description: ui.auth.accountExists, type: "error" });
    } else if (state.status === "failed") {
      toast({ description: ui.auth.createFailed, type: "error" });
    } else if (state.status === "invalid_data") {
      toast({
        description: ui.auth.validationFailed,
        type: "error",
      });
    } else if (state.status === "success") {
      toast({ description: ui.auth.accountCreated, type: "success" });
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {ui.auth.createAccount}
      </h1>
      <p className="text-sm text-muted-foreground">{ui.auth.getStarted}</p>
      <AuthForm action={handleSubmit} defaultEmail={email}>
        <SubmitButton isSuccessful={isSuccessful}>
          {ui.auth.signUp}
        </SubmitButton>
        <p className="text-center text-[13px] text-muted-foreground">
          {ui.auth.haveAccount}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href="/login"
          >
            {ui.auth.signIn}
          </Link>
        </p>
        <p className="text-center text-[12px] text-muted-foreground/70">
          <a
            className="underline-offset-4 hover:underline"
            href={ui.brand.privacyUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {ui.legal.privacy}
          </a>
          {" · "}
          <a
            className="underline-offset-4 hover:underline"
            href={ui.brand.termsUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {ui.legal.terms}
          </a>
        </p>
      </AuthForm>
    </>
  );
}
