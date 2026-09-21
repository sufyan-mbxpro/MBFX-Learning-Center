"use client";

// Picture and basic details (ADR-123 #4). Both write through the server
// actions in `_actions/account.ts`, which take the user from the session —
// nothing here names a user.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageUp, Trash2 } from "lucide-react";
import { AVATAR_MAX_BYTES, learnerProfileSchema } from "@repo/contracts";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  removeAvatarAction,
  updateAccountProfileAction,
  uploadAvatarAction,
  type AccountActionResult,
} from "../../_actions/account.ts";
import { useAccountForm } from "./use-account-form.ts";

/** The formats `setOwnAvatar` accepts — the picker's hint, not the check. */
const AVATAR_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

type Notice = { tone: "success" | "error"; text: string } | null;

export function ProfilePanel({
  profile,
}: {
  profile: {
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    image: string | null;
  };
}) {
  const t = useTranslations("account.profile");
  const router = useRouter();

  // ─── Avatar ────────────────────────────────────────────────
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatarNotice, setAvatarNotice] = useState<Notice>(null);
  const [uploading, startUpload] = useTransition();

  const avatarMessage = (result: AccountActionResult): Notice => {
    if (result.status === "ok") return { tone: "success", text: t("avatarSaved") };
    if (result.status === "limited") return { tone: "error", text: t("avatarLimited") };
    return { tone: "error", text: t("avatarRejected") };
  };

  const upload = (file: File) => {
    setAvatarNotice(null);
    // Refused here only to save a round trip; the action checks the bytes.
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarNotice({ tone: "error", text: t("avatarRejected") });
      return;
    }
    startUpload(async () => {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadAvatarAction(data);
      setAvatarNotice(avatarMessage(result));
      if (result.status === "ok") router.refresh();
    });
  };

  // ─── Details ───────────────────────────────────────────────
  const [draft, setDraft] = useState({
    name: profile.name,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
  });
  const [detailsNotice, setDetailsNotice] = useState<Notice>(null);
  const [saving, startSave] = useTransition();
  const values = {
    name: draft.name,
    firstName: draft.firstName || null,
    lastName: draft.lastName || null,
    phone: draft.phone || null,
  };
  const form = useAccountForm(learnerProfileSchema, values);
  const set = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setDetailsNotice(null);
    if (!form.validate()) return;
    startSave(async () => {
      const result = await updateAccountProfileAction(values);
      setDetailsNotice(
        result.status === "ok"
          ? { tone: "success", text: t("saved") }
          : { tone: "error", text: t("saveFailed") },
      );
      if (result.status === "ok") router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6 rounded-lg border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar size="lg" className="size-20">
          {profile.image && <AvatarImage src={profile.image} alt="" />}
          <AvatarFallback className="text-xl">{initialsOf(profile.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              type="file"
              accept={AVATAR_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) upload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp aria-hidden /> {profile.image ? t("avatarChange") : t("avatarUpload")}
            </Button>
            {profile.image && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() =>
                  startUpload(async () => {
                    const result = await removeAvatarAction();
                    setAvatarNotice(
                      result.status === "ok" ? { tone: "success", text: t("avatarRemoved") } : null,
                    );
                    if (result.status === "ok") router.refresh();
                  })
                }
              >
                <Trash2 aria-hidden /> {t("avatarRemove")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
          <NoticeLine notice={avatarNotice} />
        </div>
      </div>

      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <Field invalid={form.invalid("name")} required>
          <FieldLabel>{t("name")}</FieldLabel>
          <Input
            autoComplete="name"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <FieldDescription>{t("nameHint")}</FieldDescription>
          <FieldError>{form.error("name")}</FieldError>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field invalid={form.invalid("firstName")}>
            <FieldLabel>{t("firstName")}</FieldLabel>
            <Input
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
            <FieldError>{form.error("firstName")}</FieldError>
          </Field>
          <Field invalid={form.invalid("lastName")}>
            <FieldLabel>{t("lastName")}</FieldLabel>
            <Input
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
            <FieldError>{form.error("lastName")}</FieldError>
          </Field>
        </div>
        <Field invalid={form.invalid("phone")}>
          <FieldLabel>{t("phone")}</FieldLabel>
          <Input
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          <FieldError>{form.error("phone")}</FieldError>
        </Field>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <NoticeLine notice={detailsNotice} />
          <Button type="submit" loading={saving}>
            {t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.tone === "error" ? "alert" : "status"}
      className={
        notice.tone === "error"
          ? "text-sm text-destructive-interactive"
          : "text-sm text-success-interactive"
      }
    >
      {notice.text}
    </p>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
