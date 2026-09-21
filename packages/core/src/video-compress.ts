// Upload-time video compression (ADR-144 §4). OPTIONAL, and it can never fail
// an upload.
//
// No npm transcoder: a binary package needs an install script, which
// `onlyBuiltDependencies` exists to refuse (security.md #15). The server's own
// ffmpeg is used instead, and only when `FFMPEG_PATH` names it. Unset, this
// returns null before touching the disk and an upload behaves exactly as it
// did before ADR-144.
//
// The policy (arguments, the keep-or-discard rule, the env read) is pure and
// unit-tested without ffmpeg; `compressVideo` is the thin runner around it.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Constant rate factor for libx264. 28 is the "noticeably smaller, still
 * clean at lesson-screen sizes" end of the useful 18–28 range: these are
 * talking-head and chart-walkthrough recordings, not film.
 */
export const VIDEO_CRF = 28;
/** Encoder speed. `veryfast` because this runs inside an upload request. */
export const VIDEO_PRESET = "veryfast";
/**
 * 1080p, stated as a LONG edge of 1920 so a portrait recording is capped at
 * 1080x1920 rather than squeezed into a landscape box. Never upscales.
 */
export const VIDEO_MAX_LONG_EDGE = 1920;
/** A run past this is killed and the original is stored. */
export const VIDEO_COMPRESS_TIMEOUT_MS = 5 * 60 * 1000;

/** The configured ffmpeg binary, or null. Blank counts as unset (the `UPLOADS_DIR` lesson). */
export function ffmpegPathFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.FFMPEG_PATH?.trim();
  return configured && configured.length > 0 ? configured : null;
}

/**
 * The scale filter: long edge capped at `VIDEO_MAX_LONG_EDGE`, the other edge
 * derived (`-2` keeps the aspect ratio AND an even length, which yuv420p
 * needs), and the capped edge itself rounded down to even so an odd-sized
 * source that is already small enough does not make libx264 refuse it.
 */
export function videoScaleFilter(maxLongEdge: number = VIDEO_MAX_LONG_EDGE): string {
  const edge = (side: "iw" | "ih") => `trunc(min(${maxLongEdge}\\,${side})/2)*2`;
  return `scale=w=if(gte(iw\\,ih)\\,${edge("iw")}\\,-2):h=if(gte(iw\\,ih)\\,-2\\,${edge("ih")})`;
}

/**
 * The ffmpeg argument vector — an array handed to `execFile`, never a shell
 * string, so a path with spaces or quotes cannot become a second command.
 *
 * H.264 + AAC in MP4 is the one combination every browser plays; `+faststart`
 * moves the index to the front so playback starts before the whole file has
 * arrived. Metadata is dropped for the reason `optimizeImage` drops EXIF: a
 * phone recording carries its GPS position.
 */
export function videoCompressArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    // `?` — a silent screen recording has no audio stream, and that is fine.
    "-map",
    "0:a:0?",
    "-map_metadata",
    "-1",
    "-vf",
    videoScaleFilter(),
    "-c:v",
    "libx264",
    "-preset",
    VIDEO_PRESET,
    "-crf",
    String(VIDEO_CRF),
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}

/**
 * Keep the re-encode only when it is a real, smaller file. A source that was
 * already well encoded can come out LARGER at CRF 28, and storing that would
 * make "compression" a way to grow the library.
 */
export function shouldKeepCompressed(originalSize: number, compressedSize: number): boolean {
  return compressedSize > 0 && compressedSize < originalSize;
}

export interface CompressedVideo {
  bytes: Uint8Array;
  mimeType: "video/mp4";
  extension: "mp4";
  crf: number;
}

/** The runner, injectable so the orchestration is testable without ffmpeg. */
export type RunFfmpeg = (binary: string, args: string[], timeoutMs: number) => Promise<void>;

const runFfmpeg: RunFfmpeg = (binary, args, timeoutMs) =>
  new Promise((resolvePromise, reject) => {
    execFile(
      binary,
      args,
      { timeout: timeoutMs, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 1024 * 1024 },
      (error) => (error ? reject(error) : resolvePromise()),
    );
  });

/**
 * Re-encode `bytes` to H.264/AAC MP4, or return null to mean "store the
 * original". Null covers every way this can go wrong — no ffmpeg configured,
 * a missing binary, a timeout, a crash, an empty or larger output — because
 * the caller's contract is that compression never fails an upload.
 *
 * `isMp4` is the caller's own magic-byte sniff, run on the OUTPUT: a binary
 * at `FFMPEG_PATH` is trusted to be ffmpeg, not to have written what it
 * claims.
 */
export async function compressVideo(
  bytes: Uint8Array,
  sourceExtension: string,
  options: {
    ffmpegPath?: string | null;
    run?: RunFfmpeg;
    timeoutMs?: number;
    isMp4: (bytes: Uint8Array) => boolean;
  },
): Promise<CompressedVideo | null> {
  const binary = options.ffmpegPath === undefined ? ffmpegPathFromEnv() : options.ffmpegPath;
  if (!binary) return null;

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "mbx-video-"));
    // The extension is the sniffed one (mp4/webm), never the client's name.
    const input = join(dir, `in.${sourceExtension}`);
    const output = join(dir, "out.mp4");
    await writeFile(input, bytes);
    await (options.run ?? runFfmpeg)(
      binary,
      videoCompressArgs(input, output),
      options.timeoutMs ?? VIDEO_COMPRESS_TIMEOUT_MS,
    );
    const result = new Uint8Array(await readFile(output));
    if (!shouldKeepCompressed(bytes.length, result.length) || !options.isMp4(result)) return null;
    return { bytes: result, mimeType: "video/mp4", extension: "mp4", crf: VIDEO_CRF };
  } catch {
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
