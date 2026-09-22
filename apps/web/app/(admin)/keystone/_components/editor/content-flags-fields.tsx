"use client";

// The article editor's three switches, for every learning content editor
// (ADR-139). One component so the six editors cannot drift apart in order,
// wording or the "Not enforced yet" note under Premium.
//
// Switch first, label after, on a horizontal Field (ADR-089, code-style.md
// #25).
//
// changes-44 #5: the switches are their OWN card, `ContentFlagsSection`, and
// every learning editor renders it LAST in the right column — after the status
// panel and the settings that decide what the record is, immediately before
// the read-only Info card. As the footer of the cover card (ADR-139 #6) they
// sat above the filing and placement settings, so the three switches that
// only decide where a finished record shows were read before the fields that
// finish it.
import { useTranslations } from "next-intl";
import { ToggleRight } from "lucide-react";
import {
  Field as UiField,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@repo/ui/components/field";
import { Switch } from "@repo/ui/components/switch";
import { EditorSection } from "./editor-section.tsx";

export interface ContentFlags {
  isFeatured: boolean;
  isActive: boolean;
  isPremium: boolean;
}

export function ContentFlagsFields({
  value,
  onChange,
  disabled,
  /** A glossary topic carries its own Published/Draft switch for `isActive`. */
  showActive = true,
  /**
   * What each flag does for THIS type, so the hint never claims more than the
   * site does (code-style.md #28). `shelf`: first on a shelf with a Featured
   * view; `first`: listed first; `stored`: kept, not yet shown. `marker`: a
   * Premium marker on the public card; `stored`: kept, not yet shown.
   */
  featuredEffect = "shelf",
  premiumEffect = "marker",
}: {
  value: ContentFlags;
  onChange: (next: ContentFlags) => void;
  disabled?: boolean;
  showActive?: boolean;
  featuredEffect?: "shelf" | "first" | "stored";
  premiumEffect?: "marker" | "stored";
}) {
  const t = useTranslations("admin.contentFlags");
  return (
    <div className="flex flex-col gap-2">
      <UiField orientation="horizontal">
        <Switch
          checked={value.isFeatured}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, isFeatured: checked === true })}
        />
        <FieldContent>
          <FieldLabel className="font-normal">{t("featured")}</FieldLabel>
          <FieldDescription className="text-xs">
            {featuredEffect === "shelf"
              ? t("featuredHint")
              : featuredEffect === "first"
                ? t("featuredHintFirst")
                : t("featuredHintStored")}
          </FieldDescription>
        </FieldContent>
      </UiField>
      {showActive && (
        <UiField orientation="horizontal">
          <Switch
            checked={value.isActive}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ ...value, isActive: checked === true })}
          />
          <FieldContent>
            <FieldLabel className="font-normal">{t("active")}</FieldLabel>
            <FieldDescription className="text-xs">{t("activeHint")}</FieldDescription>
          </FieldContent>
        </UiField>
      )}
      <UiField orientation="horizontal">
        <Switch
          checked={value.isPremium}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, isPremium: checked === true })}
        />
        <FieldContent>
          <FieldLabel className="font-normal">{t("premium")}</FieldLabel>
          <FieldDescription className="text-xs">
            {premiumEffect === "marker" ? t("premiumHint") : t("premiumHintStored")}
          </FieldDescription>
        </FieldContent>
      </UiField>
    </div>
  );
}

/** The switches in their own card — see the header comment (changes-44 #5). */
export function ContentFlagsSection(props: React.ComponentProps<typeof ContentFlagsFields>) {
  const t = useTranslations("admin.contentFlags");
  return (
    <EditorSection
      title={t("sectionTitle")}
      description={t("sectionDescription")}
      icon={ToggleRight}
      accent="neutral"
    >
      <ContentFlagsFields {...props} />
    </EditorSection>
  );
}
