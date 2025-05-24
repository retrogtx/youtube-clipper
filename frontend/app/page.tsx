"use client";
import { Button } from "@/components/ui/button";
import Buy from "@/components/buy";
import { authClient } from "@/lib/auth-client";
import SignInModal from "@/components/sign-in";
import Editor from "./(auth)/editor/editor";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-screen">
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
        <div className="flex flex-col gap-6 w-full">
          <div className="flex flex-col gap-2 max-w-md">
            <h3 className="font-medium text-4xl tracking-tight">Clippa</h3>
            <p className="text-lg">
              A no-bullsh!t video clipper that allows you to clip and download
              bangers from YT.
            </p>
        <Buy product={{
          product_id: process.env.NEXT_PUBLIC_DODO_PAYMENTS_PRODUCT_ID!,
          name: "Basic Subscription",
          description: "Access to all basic features",
          price: 3,
        }} />
          </div>
          <Buy product={{
          product_id: process.env.NEXT_PUBLIC_DODO_PAYMENTS_PRODUCT_ID!,
          name: "Basic Subscription",
          description: "Access to all basic features",
          price: 3,
        }} />
          <div className="flex flex-col gap-6 rounded-xl border bg-card/25 backdrop-blur-sm p-6 shadow-lg hover:shadow-xl transition-shadow max-w-md">
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-3xl font-bold">$2</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm">Because servers aren&apos;t free 🤷‍♂️</p>
            </div>
            <ul className="flex flex-col gap-2">
              <li className="flex items-center gap-2">
                <span>✨</span>
                No sketchy ads or popups
              </li>
              <li className="flex items-center gap-2">
                <span>🚀</span>
                Unlimited clips & downloads
              </li>
              <li className="flex items-center gap-2">
                <span>🧼</span>
                Clean, no-BS experience
              </li>
              <li className="flex items-center gap-2">
                <span>❤️</span>
                Support the developers
              </li>
            </ul>
            <div className="flex w-full gap-2">
              <SignInModal trigger={<Button>Start Clipping</Button>} />

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
