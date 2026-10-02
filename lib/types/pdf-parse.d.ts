declare module 'pdf-parse/lib/pdf-parse.js' {
  type PdfResult = { text: string }
  const parse: (data: Buffer) => Promise<PdfResult>
  export = parse
}
