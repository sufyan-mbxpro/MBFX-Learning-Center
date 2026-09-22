"use client";

// A LinkTarget editor (ADR-031 §1) scoped to the cases the composer's first
// release needs to cover well: NONE/URL/ROUTE/PAGE/ANCHOR. ARTICLE/
// ARTICLE_CATEGORY/ARTICLE_TAG/COURSE/GLOSSARY_TERM/MEDIA entity pickers are
// a real gap, not an oversight — building five more content-type pickers
// is its own scope; until then those target types simply aren't offered
// here (a node authored with one some other way still renders correctly,
// this control just can't produce one).
import { isRouteKey, ROUTE_PATHS } from "@repo/contracts";
import type { LinkTarget, RouteKey } from "@repo/contracts";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export interface LinkEditorLabels {
  typeLabel: string;
  none: string;
  url: string;
  route: string;
  page: string;
  anchor: string;
  urlLabel: string;
  newTab: string;
  routeLabel: string;
  pageLabel: string;
  anchorLabel: string;
}

type SupportedLinkType = "NONE" | "URL" | "ROUTE" | "PAGE" | "ANCHOR";

const ROUTE_KEYS = Object.keys(ROUTE_PATHS) as RouteKey[];

export function LinkEditor({
  value,
  onChange,
  pages,
  labels,
}: {
  value: LinkTarget;
  onChange: (next: LinkTarget) => void;
  pages: { id: string; title: string }[];
  labels: LinkEditorLabels;
}) {
  const type: SupportedLinkType = (["NONE", "URL", "ROUTE", "PAGE", "ANCHOR"] as const).includes(
    value.type as SupportedLinkType,
  )
    ? (value.type as SupportedLinkType)
    : "NONE";

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label>{labels.typeLabel}</Label>
        <Select
          value={type}
          onValueChange={(next) => {
            if (!next) return;
            if (next === "NONE") onChange({ type: "NONE" });
            else if (next === "URL") onChange({ type: "URL", url: "" });
            else if (next === "ROUTE")
              onChange({ type: "ROUTE", routeKey: ROUTE_KEYS[0] ?? "home" });
            else if (next === "PAGE") onChange({ type: "PAGE", pageId: pages[0]?.id ?? "" });
            else if (next === "ANCHOR") onChange({ type: "ANCHOR", anchor: "" });
          }}
        >
          <SelectTrigger>
            <SelectValue>
              {
                {
                  NONE: labels.none,
                  URL: labels.url,
                  ROUTE: labels.route,
                  PAGE: labels.page,
                  ANCHOR: labels.anchor,
                }[type]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">{labels.none}</SelectItem>
            <SelectItem value="URL">{labels.url}</SelectItem>
            <SelectItem value="ROUTE">{labels.route}</SelectItem>
            <SelectItem value="PAGE">{labels.page}</SelectItem>
            <SelectItem value="ANCHOR">{labels.anchor}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.type === "URL" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{labels.urlLabel}</Label>
            <Input
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.newTab ?? false}
              onCheckedChange={(checked) => onChange({ ...value, newTab: checked === true })}
            />
            {labels.newTab}
          </label>
        </>
      )}

      {value.type === "ROUTE" && (
        <div className="flex flex-col gap-1.5">
          <Label>{labels.routeLabel}</Label>
          <Select
            value={value.routeKey}
            onValueChange={(next) =>
              next && isRouteKey(next) && onChange({ type: "ROUTE", routeKey: next })
            }
          >
            <SelectTrigger>
              <SelectValue>{value.routeKey}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROUTE_KEYS.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.type === "PAGE" && (
        <div className="flex flex-col gap-1.5">
          <Label>{labels.pageLabel}</Label>
          <Select
            value={value.pageId}
            onValueChange={(next) => next && onChange({ ...value, type: "PAGE", pageId: next })}
          >
            <SelectTrigger>
              <SelectValue>
                {pages.find((p) => p.id === value.pageId)?.title ?? value.pageId}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pages.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.type === "ANCHOR" && (
        <div className="flex flex-col gap-1.5">
          <Label>{labels.anchorLabel}</Label>
          <Input
            value={value.anchor}
            onChange={(e) => onChange({ type: "ANCHOR", anchor: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
