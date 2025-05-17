"use client";

import SignIn from "@/components/sign-in";
import { authClient } from "@/lib/auth-client";
import { redirect } from "next/navigation";

export default function Login() {
  const { 
    data: session, 
  } = authClient.useSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex flex-col justify-center items-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <SignIn />
      </div>
    </main>
  );
}