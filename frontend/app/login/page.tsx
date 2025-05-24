"use client";

import SignIn from "@/components/sign-in";
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
export default function Login() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending)
    return (
      <main className="flex flex-col justify-center items-center min-h-screen p-4">
        <Loader2 className="w-10 h-10 animate-spin" />
      </main>
    );

  if (session) {
    redirect("/editor");
  }

  return (
    <main className="flex flex-col justify-center items-center min-h-screen p-4 bg-gradient-to-b from-transparent to-rose-800/50">
      <div className="w-full max-w-md">
        <SignIn />
      </div>
    </main>
  );
}
