import type { PDFDocumentProxy } from "pdfjs-dist";
import { COVER_WIDTH } from "./book-files";

/*
 * Reads a PDF in the browser so a chosen file can be shown before it is
 * uploaded. Browser only: every function here needs the DOM.
 */

type PdfJs = typeof import("pdfjs-dist");

export interface OpenedPdf {
  doc: PDFDocumentProxy;
  pageCount: number;
  /** Frees the document. Call it when the file is replaced or the preview goes away. */
  close: () => void;
}

let pdfJs: Promise<PdfJs> | null = null;

// pdf.js is large and needs the DOM, so it loads on first use rather than with the page.
const loadPdfJs = (): Promise<PdfJs> => {
  pdfJs ??= import("pdfjs-dist").then((module) => {
    module.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return module;
  });
  return pdfJs;
};

const openFromData = async (
  data: Uint8Array,
  onClose?: () => void,
): Promise<OpenedPdf> => {
  const { getDocument } = await loadPdfJs();
  // Pass a copy: pdf.js transfers the buffer to its worker and clears the original.
  const task = getDocument({ data: data.slice() });
  const close = (): void => {
    void task.destroy();
    onClose?.();
  };

  try {
    const doc = await task.promise;
    return { doc, pageCount: doc.numPages, close };
  } catch (error) {
    close();
    throw error;
  }
};

/** Opens a PDF file. Rejects when the file is not a readable PDF. */
export const openPdf = async (file: File): Promise<OpenedPdf> => {
  const data = new Uint8Array(await file.arrayBuffer());
  return openFromData(data);
};

/**
 * Opens a PDF already served at a URL (e.g. `/api/media/.../source.pdf`).
 * Fetches the whole file first: our media route does not support HTTP range
 * requests, and pdf.js needs those when given a URL, which left pages blank.
 */
export const openPdfUrl = async (url: string): Promise<OpenedPdf> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }
  return openFromData(new Uint8Array(await response.arrayBuffer()));
};

/** Copies a rendered page onto the canvas the caller is showing. */
export const drawPageOnCanvas = (
  canvas: HTMLCanvasElement,
  rendered: HTMLCanvasElement,
): boolean => {
  const context = canvas.getContext("2d");
  if (!context) {
    return false;
  }
  canvas.width = rendered.width;
  canvas.height = rendered.height;
  context.drawImage(rendered, 0, 0);
  return true;
};

/** Draws one page (1-based) onto a new canvas `width` pixels wide. */
export const renderPage = async (
  doc: PDFDocumentProxy,
  pageNumber: number,
  width: number,
): Promise<HTMLCanvasElement> => {
  const page = await doc.getPage(pageNumber);
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / natural.width });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas;
};

/** The first page as a small image, to be saved with the book. Null when the browser cannot encode it. */
export const renderCover = async (
  doc: PDFDocumentProxy,
): Promise<Blob | null> => {
  const canvas = await renderPage(doc, 1, COVER_WIDTH);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.82);
  });
};
