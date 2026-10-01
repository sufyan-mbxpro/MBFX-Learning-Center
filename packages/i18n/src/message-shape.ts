// Is an admin's replacement for an interface string still the same MESSAGE
// as the English one (ADR-178 #4)? Pure.
//
// A catalog string is ICU MessageFormat, and the code that renders it passes
// arguments by name (`{count}`, `{name}`) and rich-text tags by name
// (`<link>…</link>`). A replacement that drops `{count}` prints a sentence
// with the number missing; one that renames a tag throws at render. So a
// replacement must parse, and must use exactly the English message's
// arguments and tags. Plural CATEGORIES are not compared: they are per
// language (Arabic has six, English two), which is the point of translating.
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";

export type MessageShapeProblem = "invalidSyntax" | "argumentsDiffer" | "tagsDiffer";

interface Shape {
  args: Set<string>;
  tags: Set<string>;
}

function collect(elements: readonly MessageFormatElement[], shape: Shape): void {
  for (const el of elements) {
    switch (el.type) {
      case TYPE.literal:
      case TYPE.pound:
        break;
      case TYPE.tag:
        shape.tags.add(el.value);
        collect(el.children, shape);
        break;
      case TYPE.plural:
      case TYPE.select:
        shape.args.add(el.value);
        for (const option of Object.values(el.options)) collect(option.value, shape);
        break;
      default:
        shape.args.add(el.value);
    }
  }
}

function shapeOf(message: string): Shape | null {
  try {
    const shape: Shape = { args: new Set(), tags: new Set() };
    collect(parse(message, { requiresOtherClause: true }), shape);
    return shape;
  } catch {
    return null;
  }
}

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((value) => b.has(value));

/**
 * Null when `value` may replace `english`; otherwise why not. An English
 * message that does not itself parse (it should never ship) leaves only the
 * syntax check, so a broken source cannot lock its key forever.
 */
export function checkMessageShape(english: string, value: string): MessageShapeProblem | null {
  const target = shapeOf(value);
  if (!target) return "invalidSyntax";
  const source = shapeOf(english);
  if (!source) return null;
  if (!sameSet(source.args, target.args)) return "argumentsDiffer";
  if (!sameSet(source.tags, target.tags)) return "tagsDiffer";
  return null;
}
