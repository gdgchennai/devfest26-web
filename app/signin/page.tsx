import { Suspense } from "react";
import type { Metadata } from "next";
import { BracketsField } from "@/components/motion/BracketsField";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Sign in",
    description: "Sign in to save sessions to your DevFest Chennai agenda.",
    path: "/signin",
    index: false,
  }),
};
export const dynamic = "force-static";

export default function SignInPage() {
  return (
    <>
      <BracketsField mode="settled" />
      <div className="relative z-10 mx-auto max-w-md px-4 pb-16 pt-24 text-center sm:pt-28">
        <p className="mb-6 max-w-sm mx-auto text-base text-paper/70 sm:text-lg">
          Manage your DevFest experience here.
        </p>
        <div className="flex justify-center">
          <Suspense fallback={null}>
            <SignInPanel />
          </Suspense>
        </div>
      </div>
    </>
  );
}
