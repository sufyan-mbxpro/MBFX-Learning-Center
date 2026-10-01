// ADR-162 #7: after the response is sent, run one entity's translation jobs,
// so a normal edit reaches every active language within seconds. The service
// already enqueued them; this only drains them early, and
// `runTranslationWork` never throws. With no active non-default locale there
// are no jobs and this does nothing.
//
// A plain module rather than a "use server" one: it is called FROM actions,
// and a server-action file may export only async actions.
import { after } from "next/server";
import { runTranslationWork } from "@repo/core";

export function translateSoon(type: string, id: string): void {
  after(() => runTranslationWork({ entity: { type, id } }));
}
