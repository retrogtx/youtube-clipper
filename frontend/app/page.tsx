"use client";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import SignInModal from "@/components/sign-in";
import Editor from "./(auth)/editor/editor";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

const fadeUpVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function App() {
  const { data: session, isPending } = authClient.useSession();

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
    <main className="min-h-screen max-w-5xl mx-auto flex flex-col items-center justify-center px-4 md:px-6 lg:px-8 pt-32 pb-12 gap-16">
      <div className="text-center flex flex-col gap-6 max-w-2xl mx-auto">
        <div className="text-center flex flex-col gap-2">
          <motion.h1
            className={`text-4xl md:text-5xl font-medium tracking-tight`}
            variants={fadeUpVariants}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5 }}
          >
            Snip Clips. Make Bangers.
          </motion.h1>

          <motion.p
            className="text-secondary-foreground text-lg max-w-md mx-auto"
            variants={fadeUpVariants}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Clippa is your platform for YT clips. Create bangers from your
            favorite moments from videos.
          </motion.p>
        </div>

        <motion.div
          className="flex gap-2 items-center justify-center"
          variants={fadeUpVariants}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <SignInModal trigger={<Button size="lg">Get started</Button>} />
        </motion.div>
      </div>

      <video
        autoPlay
        muted
        loop
        playsInline
        className="border rounded-3xl"
        src="/clippa.mp4"
      />

      <footer className="text-sm text-muted-foreground flex items-center gap-2">
        <p>© 2025 Clippa. All rights reserved.</p>
        <Link href="/terms" className="underline">
          Terms & Conditions
        </Link>
      </footer>
    </main>
  );
}
