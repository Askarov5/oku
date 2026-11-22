"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { OpenedPdf } from "@/lib/pdf-preview";
import { openPdfUrl, renderPage } from "@/lib/pdf-preview";

interface SourcePdfPageProps {
  /** The book's original PDF, as stored (e.g. `/api/media/.../source.pdf`). */
  url: string;
  /** 1-based page in that PDF. */
  pageNumber: number;
  /** Shown width of the page, in CSS pixels. */
  width?: number;
  className?: string;
}

type LoadStatus = "reading" | "ready" | "failed";

/*
 * Draws one page of the original PDF. Used when a page is saved on the book
 * but has not been digitized yet, so there is no raster in storage.
 */
export const SourcePdfPage = ({
  url,
  pageNumber,
  width = 640,
  className = "",
}: SourcePdfPageProps): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<LoadStatus>("reading");

  useEffect(() => {
    let stale = false;
    let opened: OpenedPdf | null = null;
    setStatus("reading");

    const show = async (): Promise<void> => {
      try {
        opened = await openPdfUrl(url);
        if (stale) {
          opened.close();
          opened = null;
          return;
        }
        if (pageNumber < 1 || pageNumber > opened.pageCount) {
          throw new Error(
            `Page ${pageNumber} is outside this ${opened.pageCount}-page PDF`,
          );
        }
        const density = Math.min(window.devicePixelRatio || 1, 2);
        const rendered = await renderPage(
          opened.doc,
          pageNumber,
          width * density,
        );
        if (stale) {
          return;
        }
        const target = canvasRef.current;
        const context = target?.getContext("2d");
        if (!target || !context) {
          throw new Error("Page canvas is not ready");
        }
        target.width = rendered.width;
        target.height = rendered.height;
        context.drawImage(rendered, 0, 0);
        setStatus("ready");
      } catch (error) {
        console.error("SourcePdfPage failed", error);
        if (!stale) {
          setStatus("failed");
        }
      }
    };
    void show();

    return () => {
      stale = true;
      opened?.close();
      opened = null;
    };
  }, [url, pageNumber, width]);

  return (
    <div className={className}>
      {status === "reading" ? (
        <p className="text-sm text-[var(--text-secondary)]" role="status">
          Loading original page…
        </p>
      ) : null}
      {status === "failed" ? (
        <p className="text-sm text-[var(--text-secondary)]" role="status">
          Could not open this page from the original PDF.
        </p>
      ) : null}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Original PDF page ${pageNumber}`}
        aria-busy={status === "reading"}
        className={`mx-auto block h-auto w-full max-w-full border border-[var(--border-hairline)] bg-white ${
          status === "ready" ? "" : "hidden"
        }`}
      />
    </div>
  );
};
