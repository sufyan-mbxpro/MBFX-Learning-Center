// The band both account pages open with (ADR-125 §1): the learner's picture,
// a greeting, and — while the address is unverified — a badge that says so.
//
// It also mounts `SessionSync`, because this is the one thing both pages
// render from the SERVER's view of the user: whatever it shows, the header
// menu is brought into line with.
import { getFormatter, getTranslations } from "next-intl/server";
import type { AccountProfileView } from "@repo/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Container } from "@repo/ui/components/container";
import { Section } from "@repo/ui/components/section";
import { SessionSync } from "./session-sync.tsx";
import { DATE_FORMAT_OPTIONS } from "@repo/utils";

export async function AccountMasthead({
  profile,
  locale,
  titleKey,
}: {
  profile: AccountProfileView;
  locale: string;
  titleKey: "greeting" | "progressTitle";
}) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: "account" }),
    getFormatter({ locale }),
  ]);
  const since = format.dateTime(new Date(profile.createdAt), DATE_FORMAT_OPTIONS);

  return (
    <Section spacing="sm" tone="muted" className="border-b">
      <SessionSync
        name={profile.name}
        image={profile.image}
        emailVerified={profile.emailVerified}
      />
      <Container className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar size="lg" className="size-16">
          {profile.image && <AvatarImage src={profile.image} alt="" />}
          <AvatarFallback className="text-lg">{initialsOf(profile.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(titleKey, { name: profile.name })}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {profile.email} · {t("memberSince", { date: since })}
          </p>
        </div>
        {!profile.emailVerified && (
          <Badge variant="warning" className="sm:ms-auto">
            {t("unverified")}
          </Badge>
        )}
      </Container>
    </Section>
  );
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
