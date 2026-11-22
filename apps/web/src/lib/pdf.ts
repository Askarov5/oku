import { PDFDocument } from "pdf-lib";

export const countPdfPages = async (bytes: ArrayBuffer): Promise<number> => {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
};
