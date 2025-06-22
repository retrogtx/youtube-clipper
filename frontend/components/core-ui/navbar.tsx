import { Button } from "../ui/button";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();

  return (
    <nav className="flex p-4 sticky top-0 z-50">
      <div className="flex items-center gap-4 mx-auto max-w-6xl w-full justify-between">
        <h1 className="text-2xl font-bold tracking-tight">clippa</h1>
        <Button variant="outline" onClick={() => router.push("/login")}>
          Login
        </Button>
      </div>
    </nav>
  );
}
