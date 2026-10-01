const pdfParse = require("pdf-parse");

async function extractTextFromPdf(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid PDF data.");
  }

  try {
    const data = await pdfParse(buffer);

    return {
      text: data.text || "",
      pages: data.numpages || 0
    };

  } catch (error) {
    console.error("PDF parser error:", error);

    throw new Error(
      `PDF parser failed: ${error.message}`
    );
  }
}

module.exports = {
  extractTextFromPdf
};
