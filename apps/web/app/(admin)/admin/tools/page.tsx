import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { listTools } from "@repo/core";
import { can, requirePermission } from "@repo/rbac";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { formatDate, humanizeKey } from "@repo/utils";
import { Pencil } from "lucide-react";
import { AdminPage } from "../_components/admin-page.tsx";
import { ToolEnableSwitch } from "./tool-enable-switch.tsx";

// The eight tools (Module 13, ADR-086 #1).
//
// **A list of eight, not a table of unknown length.** The SET is code, so
// there is nothing to create, nothing to delete, and no pagination to build —
// which is exactly the difference between this screen and every other content
// list in the admin. A ninth tool arrives with a deploy, not a button.
export default async function ToolsPage() {
  const subject = await requirePermission("tools.view");
  const t = await getTranslations("admin");

  const tools = await listTools();
  const canUpdate = can(subject, "tools.update");
  // Whether the site OFFERS a tool is a different privilege from writing its
  // copy. The switch re-checks server-side regardless (security.md #1).
  const canPublish = can(subject, "tools.publish");

  return (
    <AdminPage title={t("toolsAdmin.title")} description={t("toolsAdmin.description")}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {tools.map((tool) => (
          <Card key={tool.key}>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">
                    {/* ADR-044 #5 — a registry key never renders raw. */}
                    {tool.title ?? humanizeKey(tool.key)}
                  </span>
                </div>
                <Badge variant={tool.isEnabled ? "success" : "outline"}>
                  {tool.isEnabled ? t("toolsAdmin.enabled") : t("toolsAdmin.disabled")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {/* What a tool NEEDS is the thing an admin most often wants to
                    know here: five of the eight work with no provider at all,
                    and the other three explain their own empty states. */}
                <Badge variant="outline">{t(`toolsAdmin.needs.${tool.needs}`)}</Badge>
                <span>
                  {tool.curatedCount}/{tool.relatedCount} {t("toolsAdmin.relatedSuffix")}
                </span>
                <span>
                  {t("toolsAdmin.updated")} {formatDate(tool.updatedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <ToolEnableSwitch
                  toolKey={tool.key}
                  isEnabled={tool.isEnabled}
                  disabled={!canPublish}
                  label={t("toolsAdmin.enabledField")}
                />
                {canUpdate && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/admin/tools/${tool.key}`} />}
                  >
                    <Pencil aria-hidden data-icon="inline-start" />
                    {t("edit")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
