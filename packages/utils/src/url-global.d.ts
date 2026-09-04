// `URL` is a WHATWG global in every runtime this package targets (Node 18+,
// browsers, workers, React Native ≥0.74) but base.json's lib:["ES2022"]
// doesn't type it. A minimal ambient declaration beats pulling @types/node
// into a deliberately platform-agnostic package — full Node globals would
// also mask accidental Node-API use here.
declare class URL {
  constructor(input: string, base?: string);
  readonly hostname: string;
  readonly pathname: string;
  readonly protocol: string;
  readonly searchParams: { get(name: string): string | null };
}
