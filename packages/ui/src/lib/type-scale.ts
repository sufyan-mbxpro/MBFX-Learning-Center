/**
 * The class that switches a surface onto the admin type scale (ADR-054).
 *
 * Goes on `<html>` in the admin root layouts — `(admin)` and
 * `(admin-auth)`. `globals.css` defines the matching `.type-scale-admin`
 * block, which sets the `--ui-*` overrides that every `--text-*` step falls
 * back FROM; without the class, `--ui-*` is undefined everywhere and the
 * reader scale applies. That is why the public surface needs no opt-out.
 *
 * It is a constant rather than a literal in both layouts because a misspelt
 * class fails silently: the admin would simply render the reader scale,
 * which looks like this ADR regressing rather than like a typo.
 */
export const ADMIN_TYPE_SCALE_CLASS = "type-scale-admin";
