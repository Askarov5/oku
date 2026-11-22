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

/** Opens a PDF file. Rejects when the file is not a readable PDF. */
export const openPdf = async (file: File): Promise<OpenedPdf> => {
  const { getDocument } = await loadPdfJs();
  // A blob URL lets pdf.js read the file without a second copy of it in memory.
  const url = URL.createObjectURL(file);
  const task = getDocument({ url });
  const close = (): void => {
    void task.destroy();
    URL.revokeObjectURL(url);
  };

  try {
    const doc = await task.promise;
    return { doc, pageCount: doc.numPages, close };
  } catch (error) {
    close();
    throw error;
  }
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
