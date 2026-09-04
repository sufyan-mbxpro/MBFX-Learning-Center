"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui/components/button";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await fetch("/api/auth/sign-out", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
