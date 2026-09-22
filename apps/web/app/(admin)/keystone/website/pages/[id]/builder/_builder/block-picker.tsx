"use client";

// Block picker (plan §8): grouped by admin-facing behaviour, search, and
// "Start from" a saved section/block template in the SAME picker. The
// plan's four groups (§8.1) are for DYNAMIC-block vocabulary; the six
// structural blocks (section/container/columns/grid/spacer/divider) don't
// fit any of the four, so a "Layout & structure" group is added here — a
// practical, named addition, not a deviation from a locked decision.
import * as React from "react";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command";
import type { SectionTemplateSummary, SerializedBlockDefinition } from "./types.ts";

type PickerItem =
  | { kind: "block"; definition: SerializedBlockDefinition }
  | { kind: "template"; template: SectionTemplateSummary };

interface PickerGroup {
  value: string;
  items: PickerItem[];
}

export interface BlockPickerLabels {
  addBlock: string;
  searchBlocks: string;
  noBlocks: string;
  groupLayout: string;
  groupContent: string;
  groupData: string;
  startFromSection: string;
}

const GROUP_BY_CATEGORY: Record<
  SerializedBlockDefinition["category"],
  "layout" | "content" | "data"
> = {
  layout: "layout",
  content: "content",
  marketing: "content",
  collection: "content",
  detail: "content",
  data: "data",
};

export function BlockPicker({
  open,
  onOpenChange,
  definitions,
  templates,
  onPickBlock,
  onPickTemplate,
  labels,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  definitions: SerializedBlockDefinition[];
  templates: SectionTemplateSummary[];
  onPickBlock: (definition: SerializedBlockDefinition) => void;
  onPickTemplate: (template: SectionTemplateSummary) => void;
  labels: BlockPickerLabels;
}) {
  const [query, setQuery] = React.useState("");

  const groups: PickerGroup[] = React.useMemo(() => {
    const byGroup: Record<"layout" | "content" | "data", PickerItem[]> = {
      layout: [],
      content: [],
      data: [],
    };
    for (const definition of definitions) {
      byGroup[GROUP_BY_CATEGORY[definition.category]].push({ kind: "block", definition });
    }
    const templateItems: PickerItem[] = templates.map((template) => ({
      kind: "template",
      template,
    }));

    const q = query.trim().toLowerCase();
    const label = (item: PickerItem) =>
      item.kind === "block" ? item.definition.label : item.template.name;
    const filter = (items: PickerItem[]) =>
      q ? items.filter((i) => label(i).toLowerCase().includes(q)) : items;

    const result: PickerGroup[] = [];
    if (templateItems.length > 0) {
      result.push({ value: labels.startFromSection, items: filter(templateItems) });
    }
    result.push({ value: labels.groupLayout, items: filter(byGroup.layout) });
    result.push({ value: labels.groupContent, items: filter(byGroup.content) });
    result.push({ value: labels.groupData, items: filter(byGroup.data) });
    return result.filter((g) => g.items.length > 0);
  }, [definitions, templates, query, labels]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      title={labels.addBlock}
      description={labels.searchBlocks}
    >
      <Command
        items={groups}
        filteredItems={groups}
        value={query}
        onValueChange={setQuery}
        itemToStringValue={(item) =>
          (item as PickerItem).kind === "block"
            ? (item as PickerItem & { kind: "block" }).definition.label
            : (item as PickerItem & { kind: "template" }).template.name
        }
      >
        <CommandInput placeholder={labels.searchBlocks} aria-label={labels.addBlock} />
        <CommandEmpty>{labels.noBlocks}</CommandEmpty>
        <CommandList>
          {(group: PickerGroup) => (
            <CommandGroup key={group.value} items={group.items}>
              <CommandGroupLabel>{group.value}</CommandGroupLabel>
              <CommandCollection>
                {(item: PickerItem) => (
                  <CommandItem
                    key={item.kind === "block" ? item.definition.type : item.template.id}
                    value={item}
                    onClick={() => {
                      if (item.kind === "block") onPickBlock(item.definition);
                      else onPickTemplate(item.template);
                      onOpenChange(false);
                      setQuery("");
                    }}
                  >
                    {item.kind === "block" ? item.definition.label : item.template.name}
                  </CommandItem>
                )}
              </CommandCollection>
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
