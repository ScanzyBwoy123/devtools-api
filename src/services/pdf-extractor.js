const pdfParse = require("pdf-parse");

async function extractTextFromPdf(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid PDF data.");
  }

  const data = await pdfParse(buffer);

  return {
    text: data.text,
    pages: data.numpages
  };
}

module.exports = {
  extractTextFromPdf
};
