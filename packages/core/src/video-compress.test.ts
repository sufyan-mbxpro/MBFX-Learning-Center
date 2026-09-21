// ADR-144 §4 — the policy around the server's own ffmpeg, tested without it.
// The runner is injected, so every branch of "store the original instead" is
// exercised: unset, missing binary, crash, timeout, a larger or empty result,
// and output that is not an MP4 at all.
import { writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  compressVideo,
  ffmpegPathFromEnv,
  shouldKeepCompressed,
  VIDEO_CRF,
  videoCompressArgs,
  videoScaleFilter,
  type RunFfmpeg,
} from "./video-compress.ts";

const input = new Uint8Array(1000).fill(7);
/** `ftyp` at offset 4 — what the caller's sniff accepts as an MP4. */
const mp4 = (size: number) => {
  const out = new Uint8Array(size);
  out.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  return out;
};
const isMp4 = (b: Uint8Array) => b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;

/** A fake ffmpeg that writes `output` to the path it was given last. */
const writes =
  (output: Uint8Array): RunFfmpeg =>
  async (_binary, args) => {
    await writeFile(args[args.length - 1]!, output);
  };

describe("ffmpegPathFromEnv", () => {
  it("is null when FFMPEG_PATH is absent or blank, so nothing runs", () => {
    expect(ffmpegPathFromEnv({})).toBeNull();
    expect(ffmpegPathFromEnv({ FFMPEG_PATH: "" })).toBeNull();
    expect(ffmpegPathFromEnv({ FFMPEG_PATH: "   " })).toBeNull();
  });

  it("returns the trimmed path when set", () => {
    expect(ffmpegPathFromEnv({ FFMPEG_PATH: " /usr/bin/ffmpeg " })).toBe("/usr/bin/ffmpeg");
  });
});

describe("videoCompressArgs", () => {
  const args = videoCompressArgs("/tmp/in.webm", "/tmp/out.mp4");
  const after = (flag: string) => args[args.indexOf(flag) + 1];

  it("encodes H.264 + AAC in an MP4 with the index at the front", () => {
    expect(after("-c:v")).toBe("libx264");
    expect(after("-c:a")).toBe("aac");
    expect(after("-movflags")).toBe("+faststart");
    expect(after("-crf")).toBe(String(VIDEO_CRF));
    expect(after("-preset")).toBe("veryfast");
    expect(after("-pix_fmt")).toBe("yuv420p");
  });

  it("drops metadata and tolerates a video with no audio track", () => {
    expect(after("-map_metadata")).toBe("-1");
    expect(args).toContain("0:a:0?");
  });

  it("reads the input and writes the output last, as separate argv entries", () => {
    expect(after("-i")).toBe("/tmp/in.webm");
    expect(args[args.length - 1]).toBe("/tmp/out.mp4");
    expect(args).toContain("-nostdin");
  });

  it("caps the long edge without upscaling and keeps both edges even", () => {
    const filter = videoScaleFilter(1920);
    expect(filter).toContain("min(1920\\,iw)");
    expect(filter).toContain("min(1920\\,ih)");
    expect(filter).toContain("-2");
    expect(after("-vf")).toBe(filter);
  });
});

describe("shouldKeepCompressed", () => {
  it("keeps only a non-empty, strictly smaller result", () => {
    expect(shouldKeepCompressed(1000, 400)).toBe(true);
    expect(shouldKeepCompressed(1000, 1000)).toBe(false);
    expect(shouldKeepCompressed(1000, 1200)).toBe(false);
    expect(shouldKeepCompressed(1000, 0)).toBe(false);
  });
});

describe("compressVideo never fails an upload", () => {
  it("does nothing at all when no ffmpeg is configured", async () => {
    const run = vi.fn();
    expect(await compressVideo(input, "mp4", { ffmpegPath: null, run, isMp4 })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("returns the smaller MP4 when the encode shrinks the file", async () => {
    const result = await compressVideo(input, "webm", {
      ffmpegPath: "ffmpeg",
      run: writes(mp4(400)),
      isMp4,
    });
    expect(result).not.toBeNull();
    expect(result!.bytes.length).toBe(400);
    expect(result!.mimeType).toBe("video/mp4");
    expect(result!.extension).toBe("mp4");
    expect(result!.crf).toBe(VIDEO_CRF);
  });

  it.each([
    ["a larger result", writes(mp4(2000))],
    ["an empty result", writes(new Uint8Array(0))],
    ["output that is not an MP4", writes(new Uint8Array(100).fill(1))],
    [
      "a crash or a timeout",
      (async () => {
        throw Object.assign(new Error("killed"), { killed: true, signal: "SIGKILL" });
      }) as RunFfmpeg,
    ],
    ["a run that writes nothing", (async () => undefined) as RunFfmpeg],
  ])("falls back to the original on %s", async (_label, run) => {
    expect(await compressVideo(input, "mp4", { ffmpegPath: "ffmpeg", run, isMp4 })).toBeNull();
  });

  it("falls back when the configured binary does not exist", async () => {
    expect(
      await compressVideo(input, "mp4", {
        ffmpegPath: "/definitely/not/ffmpeg-binary",
        isMp4,
        timeoutMs: 5_000,
      }),
    ).toBeNull();
  });

  it("passes the timeout through to the runner", async () => {
    const run = vi.fn<RunFfmpeg>(async () => undefined);
    await compressVideo(input, "mp4", { ffmpegPath: "ffmpeg", run, isMp4, timeoutMs: 1234 });
    expect(run).toHaveBeenCalledWith("ffmpeg", expect.any(Array), 1234);
  });
});
