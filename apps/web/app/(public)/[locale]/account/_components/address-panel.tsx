"use client";

// The learner's postal address (ADR-155 #5). Saved on its own, through
// `updateAccountAddressAction`, so fixing a postcode never submits a
// half-edited name from the profile card.
//
// A country is stored as its ISO code. Its NAME comes from `Intl.DisplayNames`
// in the page's locale, so the list reads in the reader's language without a
// catalog carrying 249 names.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import {
  COUNTRY_CODES,
  learnerAddressSchema,
  type AccountAddressView,
} from "@repo/contracts";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Combobox, type ComboboxOption } from "@repo/ui/components/combobox";
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { updateAccountAddressAction } from "../../_actions/account.ts";
import { AccountCard } from "./account-card.tsx";
import { NoticeLine } from "./profile-panel.tsx";
import { useAccountForm } from "./use-account-form.ts";

type Notice = { tone: "success" | "error"; text: string } | null;
type Draft = { [K in keyof AccountAddressView]: string };

/** The country list in the reader's language, sorted by name in that language. */
function useCountryOptions(noneLabel: string): ComboboxOption[] {
  const locale = useLocale();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      // An engine without region names still gets a usable (if terse) list.
    }
    const collator = new Intl.Collator(locale);
    const countries = COUNTRY_CODES.map((code) => ({
      value: code,
      label: names?.of(code) ?? code,
    })).sort((a, b) => collator.compare(a.label, b.label));
    return [{ value: "", label: noneLabel }, ...countries];
  }, [locale, noneLabel]);
}

export function AddressPanel({ address }: { address: AccountAddressView }) {
  const t = useTranslations("account.address");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    addressLine1: address.addressLine1 ?? "",
    addressLine2: address.addressLine2 ?? "",
    city: address.city ?? "",
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    country: address.country ?? "",
  });
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, startSave] = useTransition();
  const form = useAccountForm(learnerAddressSchema, draft);
  const countries = useCountryOptions(t("countryNone"));
  const set = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const onFile = Boolean(address.addressLine1 && address.city && address.country);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!form.validate()) return;
    startSave(async () => {
      // Blank lines go as "" and the schema turns them into null.
      const result = await updateAccountAddressAction(draft);
      setNotice(
        result.status === "ok"
          ? { tone: "success", text: t("saved") }
          : { tone: "error", text: t("saveFailed") },
      );
      if (result.status === "ok") router.refresh();
    });
  };

  return (
    <AccountCard
      id="account-address"
      icon={MapPin}
      tone="success"
      title={t("title")}
      description={t("description")}
      status={
        <Badge variant={onFile ? "success" : "outline"}>
          {onFile ? t("onFile") : t("notSet")}
        </Badge>
      }
    >
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <Field invalid={form.invalid("addressLine1")}>
          <FieldLabel>{t("line1")}</FieldLabel>
          <Input
            autoComplete="address-line1"
            value={draft.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
          <FieldError>{form.error("addressLine1")}</FieldError>
        </Field>
        <Field invalid={form.invalid("addressLine2")}>
          <FieldLabel>{t("line2")}</FieldLabel>
          <Input
            autoComplete="address-line2"
            value={draft.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />
          <FieldError>{form.error("addressLine2")}</FieldError>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field invalid={form.invalid("city")}>
            <FieldLabel>{t("city")}</FieldLabel>
            <Input
              autoComplete="address-level2"
              value={draft.city}
              onChange={(e) => set("city", e.target.value)}
            />
            <FieldError>{form.error("city")}</FieldError>
          </Field>
          <Field invalid={form.invalid("region")}>
            <FieldLabel>{t("region")}</FieldLabel>
            <Input
              autoComplete="address-level1"
              value={draft.region}
              onChange={(e) => set("region", e.target.value)}
            />
            <FieldError>{form.error("region")}</FieldError>
          </Field>
          <Field invalid={form.invalid("postalCode")}>
            <FieldLabel>{t("postalCode")}</FieldLabel>
            <Input
              autoComplete="postal-code"
              value={draft.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
            <FieldError>{form.error("postalCode")}</FieldError>
          </Field>
          <Field invalid={form.invalid("country")}>
            <FieldLabel>{t("country")}</FieldLabel>
            <Combobox
              options={countries}
              value={draft.country}
              onValueChange={(value) => set("country", value)}
              placeholder={t("countryPlaceholder")}
              searchPlaceholder={t("countrySearch")}
              emptyLabel={t("countryEmpty")}
            />
            <FieldError>{form.error("country")}</FieldError>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <NoticeLine notice={notice} />
          <Button type="submit" loading={saving}>
            {t("save")}
          </Button>
        </div>
      </form>
    </AccountCard>
  );
}
