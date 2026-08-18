"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/Button";

async function signOutTo(to: string, router: ReturnType<typeof useRouter>) {
  await signOut({ redirect: false });
  router.push(to);
  router.refresh();
}

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <Button
        variant="danger"
        size="md"
        onClick={() => signOutTo("/login", router)}
        className="!px-3.5 !py-2 text-[13px]"
      >
        Log out
      </Button>
      <SwitchAccountButton />
    </div>
  );
}

/** Kuwana-green action — signs the current account out and lands on /login. */
export function SwitchAccountButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => signOutTo("/login", router)}
      className={clsx(
        "!border-transparent !bg-[#0d7568] !px-3.5 !py-2 !text-[13px] !text-white hover:!brightness-110",
        className,
      )}
    >
      Switch account
    </Button>
  );
}
