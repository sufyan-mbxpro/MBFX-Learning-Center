// A plain server module — see client.tsx's comment for why the actual
// component lives there and this file only registers a reference to it.
import { registerBlock } from "../registry.ts";
import { definition } from "./definition.ts";
import { CollectionSearchBlock } from "./client.tsx";

registerBlock(definition, CollectionSearchBlock);

export { CollectionSearchBlock };
