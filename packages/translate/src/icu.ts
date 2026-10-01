// Catalog messages (ICU MessageFormat) through a machine translator. Pure:
// the translator is passed in.
//
// Three things a naive "send the string to Google" gets wrong, and this file
// exists to get right:
//
//   1. **Arguments and tags are not text.** `{name}`, `{count, number}`, `#`
//      and next-intl's rich-text tags (`<link>…</link>`) are protected: an
//      argument travels as `<span translate="no" data-ph="N">`, a tag as
//      `<span data-tg="N">` whose CONTENT is translated. After translation
//      every placeholder must come back exactly once, or the message is
//      refused rather than written broken.
//   2. **A plural is a set of sentences.** `hoistSelectors` lifts every
//      plural/select to the top, so "You have {n, plural, one {# item} other
//      {# items}} left" is sent as two full sentences, not as fragments.
//   3. **Plural CATEGORIES are per language.** English has `one` / `other`;
//      Arabic has `zero` / `one` / `two` / `few` / `many` / `other`.
//      Translating the two English branches cannot produce the six Arabic
//      ones. The target's categories come from `Intl.PluralRules`, each is
//      filled from the matching source branch or else from `other`, and the
//      key is reported so a person can correct the forms that need it.
import {
  parse,
  TYPE,
  type MessageFormatElement,
  type PluralElement,
  type PluralOrSelectOption,
  type SelectElement,
  type TagElement,
} from "@formatjs/icu-messageformat-parser";
import {
  hoistSelectors,
  isStructurallySame,
} from "@formatjs/icu-messageformat-parser/manipulator.js";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";

import { decodeEntities, escapeHtml } from "./html.ts";

/** A message this pipeline will not machine-translate. The key is reported. */
export class UnsupportedMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedMessageError";
  }
}

/** A translation came back with a placeholder lost, duplicated or invented. */
export class PlaceholderMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaceholderMismatchError";
  }
}

interface LeafNode {
  kind: "leaf";
  unit: number;
  placeholders: MessageFormatElement[];
  tags: TagElement[];
}

interface SelectorNode {
  kind: "selector";
  element: PluralElement | SelectElement;
  options: Array<{ key: string; node: MessageNode }>;
}

type MessageNode = LeafNode | SelectorNode;

export interface MessagePlan {
  /** HTML strings to send to the translator, in order. */
  units: string[];
  root: MessageNode;
  /** The parsed source, for the structural check after rebuilding. */
  source: MessageFormatElement[];
}

function isSelector(el: MessageFormatElement): el is PluralElement | SelectElement {
  return el.type === TYPE.plural || el.type === TYPE.select;
}

function containsSelector(ast: readonly MessageFormatElement[]): boolean {
  return ast.some(
    (el) => isSelector(el) || (el.type === TYPE.tag && containsSelector(el.children)),
  );
}

function serializeLeaf(elements: readonly MessageFormatElement[], leaf: LeafNode): string {
  return elements
    .map((el) => {
      switch (el.type) {
        case TYPE.literal:
          return escapeHtml(el.value);
        case TYPE.tag: {
          const index = leaf.tags.push(el) - 1;
          return `<span data-tg="${index}">${serializeLeaf(el.children, leaf)}</span>`;
        }
        case TYPE.plural:
        case TYPE.select:
          // hoistSelectors leaves none here; one that survives is nested in a
          // way it could not lift.
          throw new UnsupportedMessageError("A plural or select could not be lifted to the top");
        default: {
          const index = leaf.placeholders.push(el) - 1;
          const shown = el.type === TYPE.pound ? "#" : printAST([el]);
          return `<span translate="no" data-ph="${index}">${escapeHtml(shown)}</span>`;
        }
      }
    })
    .join("");
}

function buildNode(ast: MessageFormatElement[], units: string[]): MessageNode {
  const only = ast.length === 1 ? ast[0] : undefined;
  if (only && isSelector(only)) {
    return {
      kind: "selector",
      element: only,
      options: Object.entries(only.options).map(([key, option]) => ({
        key,
        node: buildNode(option.value, units),
      })),
    };
  }
  const leaf: LeafNode = { kind: "leaf", unit: units.length, placeholders: [], tags: [] };
  units.push(serializeLeaf(ast, leaf));
  return leaf;
}

/** Parses a catalog message and lists the units to translate. */
export function planMessage(message: string): MessagePlan {
  let source: MessageFormatElement[];
  try {
    source = parse(message, { requiresOtherClause: true });
  } catch (error) {
    throw new UnsupportedMessageError(`Not valid ICU: ${(error as Error).message}`);
  }

  let ast = source;
  if (containsSelector(source)) {
    try {
      ast = hoistSelectors(structuredClone(source));
    } catch (error) {
      throw new UnsupportedMessageError(`Cannot lift its plural: ${(error as Error).message}`);
    }
  }

  const units: string[] = [];
  const root = buildNode(ast, units);
  return { units, root, source };
}

const SPAN_TOKEN = /<span\b([^>]*)>|<\/span\s*>|[^<]+|</g;

interface Frame {
  kind: "root" | "tag" | "ph" | "other";
  children: MessageFormatElement[];
  index: number;
}

/** Turns a translated unit back into elements, checking every placeholder. */
function deserializeLeaf(html: string, leaf: LeafNode): MessageFormatElement[] {
  const root: Frame = { kind: "root", children: [], index: -1 };
  const stack: Frame[] = [root];
  const seenPlaceholders = new Map<number, number>();
  const seenTags = new Map<number, number>();

  const top = () => stack[stack.length - 1] ?? root;
  const pushLiteral = (text: string) => {
    const frame = top();
    if (frame.kind === "ph" || text === "") return;
    const last = frame.children[frame.children.length - 1];
    if (last?.type === TYPE.literal) last.value += text;
    else frame.children.push({ type: TYPE.literal, value: text });
  };

  for (const match of html.matchAll(SPAN_TOKEN)) {
    const [token, attributes] = match;
    if (token.startsWith("<span")) {
      const ph = /\bdata-ph\s*=\s*"?(\d+)/.exec(attributes ?? "");
      const tg = /\bdata-tg\s*=\s*"?(\d+)/.exec(attributes ?? "");
      if (ph) stack.push({ kind: "ph", children: [], index: Number(ph[1]) });
      else if (tg) stack.push({ kind: "tag", children: [], index: Number(tg[1]) });
      else stack.push({ kind: "other", children: [], index: -1 });
    } else if (token.startsWith("</span")) {
      const frame = stack.pop();
      if (!frame || frame === root) throw new PlaceholderMismatchError("Unbalanced markup");
      const parent = top();
      if (frame.kind === "ph") {
        const element = leaf.placeholders[frame.index];
        if (!element) throw new PlaceholderMismatchError(`Unknown placeholder ${frame.index}`);
        seenPlaceholders.set(frame.index, (seenPlaceholders.get(frame.index) ?? 0) + 1);
        parent.children.push(structuredClone(element));
      } else if (frame.kind === "tag") {
        const tag = leaf.tags[frame.index];
        if (!tag) throw new PlaceholderMismatchError(`Unknown tag ${frame.index}`);
        seenTags.set(frame.index, (seenTags.get(frame.index) ?? 0) + 1);
        parent.children.push({ type: TYPE.tag, value: tag.value, children: frame.children });
      } else {
        // A span Google added: keep its words, drop the element.
        for (const child of frame.children) {
          if (child.type === TYPE.literal) pushLiteral(child.value);
          else parent.children.push(child);
        }
      }
    } else {
      pushLiteral(decodeEntities(token));
    }
  }

  if (stack.length !== 1) throw new PlaceholderMismatchError("Unbalanced markup");
  const everyOnce = (seen: Map<number, number>, total: number) =>
    seen.size === total && [...seen.values()].every((count) => count === 1);
  if (!everyOnce(seenPlaceholders, leaf.placeholders.length)) {
    throw new PlaceholderMismatchError("An argument was lost or repeated in translation");
  }
  if (!everyOnce(seenTags, leaf.tags.length)) {
    throw new PlaceholderMismatchError("A tag was lost or repeated in translation");
  }
  return root.children;
}

const CATEGORY_ORDER = ["zero", "one", "two", "few", "many", "other"];

function pluralCategories(locale: string, type: Intl.PluralRuleType | undefined): string[] {
  const categories = new Intl.PluralRules(locale, { type: type ?? "cardinal" }).resolvedOptions()
    .pluralCategories as string[];
  return [...categories].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
}

interface RebuildState {
  translated: readonly string[];
  locale: string;
  pluralsRebuilt: boolean;
}

function rebuildNode(node: MessageNode, state: RebuildState): MessageFormatElement[] {
  if (node.kind === "leaf") {
    const text = state.translated[node.unit];
    if (text === undefined) throw new PlaceholderMismatchError(`Missing translation ${node.unit}`);
    return deserializeLeaf(text, node);
  }

  const byKey = new Map(node.options.map((option) => [option.key, option.node]));
  const options: Record<string, PluralOrSelectOption> = {};

  if (node.element.type === TYPE.select) {
    for (const option of node.options) {
      options[option.key] = { value: rebuildNode(option.node, state) };
    }
    return [{ ...node.element, options }];
  }

  // Exact matches (`=0`) mean the same thing in every language: keep them.
  for (const option of node.options) {
    if (option.key.startsWith("="))
      options[option.key] = { value: rebuildNode(option.node, state) };
  }
  const sourceCategories = node.options.map((o) => o.key).filter((k) => !k.startsWith("="));
  const targetCategories = pluralCategories(state.locale, node.element.pluralType);
  const fallback = byKey.get("other");
  for (const category of targetCategories) {
    const source = byKey.get(category) ?? fallback;
    if (!source) throw new UnsupportedMessageError("A plural has no `other` branch");
    options[category] = { value: rebuildNode(source, state) };
  }
  const same =
    sourceCategories.length === targetCategories.length &&
    sourceCategories.every((c) => targetCategories.includes(c));
  if (!same) state.pluralsRebuilt = true;
  return [{ ...node.element, options }];
}

export interface RebuiltMessage {
  message: string;
  /** The target's plural categories differ from the source's: a person should read it. */
  pluralsRebuilt: boolean;
}

/** Puts a translated message back together and checks it is still valid ICU. */
export function rebuildMessage(
  plan: MessagePlan,
  translated: readonly string[],
  targetLocale: string,
): RebuiltMessage {
  const state: RebuildState = { translated, locale: targetLocale, pluralsRebuilt: false };
  const message = printAST(rebuildNode(plan.root, state));

  let reparsed: MessageFormatElement[];
  try {
    reparsed = parse(message, { requiresOtherClause: true });
  } catch (error) {
    throw new PlaceholderMismatchError(
      `Rebuilt message is not valid ICU: ${(error as Error).message}`,
    );
  }
  const structure = isStructurallySame(plan.source, reparsed);
  if (!structure.success) {
    throw new PlaceholderMismatchError(
      `Rebuilt message changed its arguments: ${structure.error?.message ?? "unknown"}`,
    );
  }
  return { message, pluralsRebuilt: state.pluralsRebuilt };
}

export interface CatalogTranslation {
  translated: Record<string, string>;
  /** Keys whose plural forms were rebuilt for the target language. */
  review: string[];
  /** Keys that could not be translated, and why. Left untranslated. */
  failed: Array<{ key: string; reason: string }>;
}

/**
 * Translates a flat `{ key: message }` map. `translateUnits` receives every
 * unit of every message in one list, so the caller can batch across keys.
 */
export async function translateCatalogMessages(
  messages: Readonly<Record<string, string>>,
  targetLocale: string,
  translateUnits: (units: string[]) => Promise<string[]>,
): Promise<CatalogTranslation> {
  const result: CatalogTranslation = { translated: {}, review: [], failed: [] };
  const plans: Array<{ key: string; plan: MessagePlan; offset: number }> = [];
  const allUnits: string[] = [];

  for (const [key, message] of Object.entries(messages)) {
    try {
      const plan = planMessage(message);
      plans.push({ key, plan, offset: allUnits.length });
      allUnits.push(...plan.units);
    } catch (error) {
      result.failed.push({ key, reason: (error as Error).message });
    }
  }

  const answers = allUnits.length > 0 ? await translateUnits(allUnits) : [];

  for (const { key, plan, offset } of plans) {
    try {
      const rebuilt = rebuildMessage(
        plan,
        answers.slice(offset, offset + plan.units.length),
        targetLocale,
      );
      result.translated[key] = rebuilt.message;
      if (rebuilt.pluralsRebuilt) result.review.push(key);
    } catch (error) {
      result.failed.push({ key, reason: (error as Error).message });
    }
  }
  return result;
}
