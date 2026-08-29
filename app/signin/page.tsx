import { Suspense } from "react";
import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { SignInPanel } from "@/components/auth/SignInPanel";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to save sessions to your DevFest Chennai agenda.",
};

export default function SignInPage() {
  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sign in</h1>
        <p className="mt-3 max-w-sm text-paper/70">
          Manage your DevFest experience here.
        </p>
        <Suspense fallback={null}>
          <SignInPanel />
        </Suspense>
      </div>
    </>
  );
}
