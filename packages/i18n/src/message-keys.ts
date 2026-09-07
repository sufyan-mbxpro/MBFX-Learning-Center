// Typed message keys (changes-09-plan.md §5.1/§5.2).
//
// next-intl's `t()` is not key-typed in this repo — there is no `AppConfig`
// augmentation — so a registry that stores catalog keys as DATA (the About
// facts module, the mega-menu panel registry) has no compile-time link back
// to the catalog. These types are that link: a renamed or deleted key
// becomes a type error where the key is stored, instead of a blank string
// on the page at runtime.
//
// `import type` of the JSON is erased at compile time under
// verbatimModuleSyntax — the catalog never reaches a bundle through this
// file. It is the same catalog `request.ts` imports as a value for the
// missing-key fallback, so there is exactly one source of truth.
import type enMessages from "../messages/en.json";

/** The English catalog's shape — the type source for every other catalog. */
export type Messages = typeof enMessages;

/** A top-level namespace, as `getTranslations(namespace)` takes it. */
export type MessageNamespace = keyof Messages;

/** Flattens a nested message object to its dotted leaf paths. */
type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}`;
    }[keyof T & string];

/**
 * A key WITHIN a namespace, in the shape `t()` takes after
 * `getTranslations("<namespace>")` has already scoped it:
 *
 *   const t = await getTranslations("about");
 *   const key: MessageKey<"about"> = "shared.learnMore";
 *   t(key); // ✓ compiles, and stays compiling only while the key exists
 */
export type MessageKey<N extends MessageNamespace> = Leaves<Messages[N]>;
