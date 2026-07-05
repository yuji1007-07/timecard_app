declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseOptions = {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
  };
  function pdfParse(buffer: Buffer, options?: PdfParseOptions): Promise<{ numpages: number; text: string }>;
  export default pdfParse;
}
