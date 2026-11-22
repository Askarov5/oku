"use client";

import { Button, ChevronLeftIcon, ChevronRightIcon } from "@oku/ui";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { formatFileSize } from "@/lib/book-files";
import type { OpenedPdf } from "@/lib/pdf-preview";
import { openPdf, renderCover, renderPage } from "@/lib/pdf-preview";

/** What the form learns from the chosen file. */
export interface PdfPreviewResult {
  pageCount: number;
  /** First page as an image, uploaded with the PDF. Null when it could not be made. */
  cover: Blob | null;
}

interface PdfPreviewProps {
  file: File;
  /** Called once per file when reading ends; null when the file cannot be previewed. */
  onRead: (result: PdfPreviewResult | null) => void;
}

type PreviewStatus = "reading" | "ready" | "failed";

/** Shown width of a page, in CSS pixels. Matches `max-w-[320px]` on the canvas. */
const PAGE_WIDTH = 320;

/*
 * Shows the chosen PDF before it is uploaded: file name, page count and size,
 * and its pages one at a time, so the page range can be checked against the
 * real pages.
 */
export const PdfPreview = ({ file, onRead }: PdfPreviewProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadRef = useRef(onRead);
  const [pdf, setPdf] = useState<OpenedPdf | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("reading");
  const [page, setPage] = useState(1);
  // The page on the canvas right now. It trails `page` while a page is being drawn.
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);

  // Open the file, then make the image that is saved with the book.
  useEffect(() => {
    let stale = false;
    let opened: OpenedPdf | null = null;
    setPdf(null);
    setStatus("reading");
    setPage(1);
    setDrawn(0);

    const read = async (): Promise<void> => {
      try {
        opened = await openPdf(file);
        if (stale) {
          opened.close();
          return;
        }
        setPdf(opened);
        setStatus("ready");
        const cover = await renderCover(opened.doc).catch(() => null);
        if (!stale) {
          onReadRef.current({ pageCount: opened.pageCount, cover });
        }
      } catch {
        if (!stale) {
          setStatus("failed");
          onReadRef.current(null);
        }
      }
    };
    void read();

    return () => {
      stale = true;
      opened?.close();
    };
  }, [file]);

  // Draw the current page. Each page renders off screen, so quick stepping never shares a canvas.
  useEffect(() => {
    const target = canvasRef.current;
    if (!pdf || !target) {
      return;
    }
    let stale = false;
    const density = Math.min(window.devicePixelRatio || 1, 2);

    renderPage(pdf.doc, page, PAGE_WIDTH * density)
      .then((rendered) => {
        if (stale) {
          return;
        }
        target.width = rendered.width;
        target.height = rendered.height;
        target.getContext("2d")?.drawImage(rendered, 0, 0);
        setDrawn(page);
      })
      .catch(() => {
        if (!stale) {
          setStatus("failed");
        }
      });

    return () => {
      stale = true;
    };
  }, [pdf, page]);

  const pageCount = pdf?.pageCount ?? 0;

  return (
    <section aria-label="PDF preview" className="text-sm">
      {/* The file input above already shows the name; this adds what it cannot. */}
      <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
        {status === "ready"
          ? `${pageCount} ${pageCount === 1 ? "page" : "pages"} · `
          : null}
        {formatFileSize(file.size)}
      </p>

      {status === "reading" ? (
        <p className="mt-2 text-[var(--text-secondary)]" role="status">
          Reading PDF…
        </p>
      ) : null}

      {status === "failed" ? (
        <p className="mt-2 text-[var(--text-secondary)]" role="status">
          This file cannot be previewed. It may be damaged, password-protected,
          or not a PDF.
        </p>
      ) : null}

      {status === "ready" ? (
        <>
          <div className="mt-2 rounded-[var(--rounded-xs)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2">
            {/*
             * Until the new page is drawn the old one stays, dimmed, so the frame
             * never jumps. Before the first draw the canvas holds a page-shaped space.
             */}
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Page ${page} of ${file.name}`}
              aria-busy={drawn !== page}
              className={`mx-auto block h-auto w-full max-w-[320px] border border-[var(--border-hairline)] bg-white transition-opacity ${
                drawn === page ? "opacity-100" : "opacity-40"
              } ${drawn === 0 ? "aspect-[1/1.414]" : ""}`}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeftIcon />
            </Button>
            <p
              className="font-mono text-xs tabular-nums text-[var(--text-secondary)]"
              aria-live="polite"
            >
              Page {page} of {pageCount}
            </p>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next page"
              disabled={page >= pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
};
