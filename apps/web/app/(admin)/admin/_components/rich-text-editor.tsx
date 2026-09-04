"use client";

// Tiptap rich-text editor (changes-02; ADR-009's "editor lands after the
// pipeline" — the pipeline is already there). HTML in, HTML out: the
// editor ingests the stored body and emits StarterKit/Link/Image markup
// that sanitizeRichText() passes through unchanged (core's
// sanitize-tiptap.test.ts pins the vocabulary). Sanitization still happens
// SERVER-side on save — this widget is authoring convenience, never the
// boundary. Admin-only dependency (architecture.md #5): lives under the
// admin route group, never imported by (public).
import * as React from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { cn } from "@repo/ui/lib/utils";
import { uploadImageAction } from "../_actions/media-actions.ts";

export interface RichTextLabels {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  heading2: string;
  heading3: string;
  bulletList: string;
  orderedList: string;
  blockquote: string;
  codeBlock: string;
  link: string;
  unlink: string;
  image: string;
  horizontalRule: string;
  undo: string;
  redo: string;
  linkPrompt: string;
  placeholder: string;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      // Keep the editor selection: a mousedown on the toolbar would blur it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({
  id,
  value,
  onChange,
  labels,
  className,
}: {
  id?: string;
  /** Stored HTML (sanitized server-side on the last save). */
  value: string;
  onChange: (html: string) => void;
  labels: RichTextLabels;
  className?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  const editor = useEditor({
    // SSR-safe: Next renders this client component on the server first.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: labels.placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        // Mirrors the public article body's typography so what admins see
        // is what readers get.
        class:
          "min-h-72 max-w-none px-3 py-2 text-sm leading-relaxed outline-none [&_a]:text-primary-interactive [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:font-semibold [&_hr]:my-4 [&_img]:my-2 [&_img]:max-h-96 [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:list-disc [&_ul]:ps-5 [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-start [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
        ...(id ? { id } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    // Toolbar active states live on the editor, not React state — nudge a
    // re-render on selection/transaction so aria-pressed stays honest.
    onSelectionUpdate: () => force(),
    onTransaction: () => force(),
  });

  const setLink = (e: Editor) => {
    const previous = e.getAttributes("link").href as string | undefined;
    const url = window.prompt(labels.linkPrompt, previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      e.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    e.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const insertImage = async (e: Editor, file: File | undefined) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("purpose", "content");
      const stored = await uploadImageAction(formData);
      e.chain().focus().setImage({ src: stored.url, alt: file.name }).run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!editor) {
    return (
      <div className={cn("min-h-72 rounded-lg border bg-transparent", className)} aria-busy />
    );
  }

  const can = editor.can();

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label={labels.bold}
        className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1"
      >
        <ToolbarButton
          label={labels.bold}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.italic}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.underline}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.strike}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough aria-hidden />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5!" />
        <ToolbarButton
          label={labels.heading2}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.heading3}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.bulletList}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.orderedList}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.blockquote}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.codeBlock}
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code aria-hidden />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5!" />
        <ToolbarButton
          label={labels.link}
          active={editor.isActive("link")}
          onClick={() => setLink(editor)}
        >
          <LinkIcon aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.unlink}
          disabled={!editor.isActive("link")}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Unlink aria-hidden />
        </ToolbarButton>
        <ToolbarButton label={labels.image} onClick={() => fileRef.current?.click()}>
          <ImagePlus aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.horizontalRule}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus aria-hidden />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-1 h-5!" />
        <ToolbarButton
          label={labels.undo}
          disabled={!can.undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={labels.redo}
          disabled={!can.redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 aria-hidden />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void insertImage(editor, e.target.files?.[0])}
      />
    </div>
  );
}
