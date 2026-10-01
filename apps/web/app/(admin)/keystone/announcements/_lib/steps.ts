// The four editor steps (ADR-171, changes-54 §10.3), in a PLAIN module: the
// server page reads them to parse `?step=`, and a value exported from a
// "use client" file is a client reference on the server, not the array.
export const ANNOUNCEMENT_STEPS = ["content", "message", "audience", "review"] as const;
export type AnnouncementStep = (typeof ANNOUNCEMENT_STEPS)[number];

/**
 * A custom email's three steps (ADR-172): its words ARE the content, so there
 * is no separate "Subject & message" step to write them in.
 */
export const CUSTOM_EMAIL_STEPS = ["content", "audience", "review"] as const;
export type CustomEmailStep = (typeof CUSTOM_EMAIL_STEPS)[number];
