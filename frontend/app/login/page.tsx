import SignIn from "@/components/sign-in";

export default function Login() {
  return (
    <main className="flex flex-col justify-center items-center min-h-screen p-4">
      <div className="w-full max-w-md">
        <SignIn />
      </div>
    </main>
  );
}