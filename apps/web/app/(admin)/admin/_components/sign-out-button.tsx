"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@repo/ui/components/button";

export function SignOutButton({ label, iconOnly }: { label: string; iconOnly?: boolean }) {
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  // iconOnly is the collapsed-sidebar rail (ADR-040's shell work): the
  // label moves to aria-label/title rather than disappearing.
  if (iconOnly) {
    return (
      <Button variant="outline" size="icon" aria-label={label} title={label} onClick={signOut}>
        <LogOut aria-hidden className="size-4 rtl:rotate-180" />
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut}>
      {label}
    </Button>
  );
}
