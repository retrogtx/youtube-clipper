"use client";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import SignInModal from "@/components/sign-in";
import Editor from "./(auth)/editor/editor";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (!isPending && session) {
    return <Editor />;
  }

  return (
    <main className="flex flex-col min-h-screen gap-6 relative overflow-hidden justify-end items-start w-full">
      <section className="flex flex-col p-6 w-full">
        <div className="flex flex-col gap-6 rounded-xl border bg-card/25 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-shadow max-w-md">
          <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-2 max-w-md">
              <h3 className="font-medium text-4xl tracking-tight">Clippa</h3>
              <p className="">
                A no-bullsh!t video clipper that allows you to clip and download
                bangers from YT.
              </p>
            </div>

            <div className="flex w-full gap-2">
              <SignInModal trigger={<Button>Get Started</Button>} />

              <Button
                variant="outline"
                onClick={() =>
                  router.push("https://github.com/retrogtx/youtube-clipper/")
                }
              >
                Self-host Clippa
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
