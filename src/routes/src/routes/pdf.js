const express = require("express");
const multer = require("multer");
const { extractTextFromPdf } = require("../services/pdf-extractor");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Please upload a PDF file using the 'file' field."
      });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        error: "Only PDF files are supported."
      });
    }

    const result = await extractTextFromPdf(req.file.buffer);

    return res.json({
      success: true,
      filename: req.file.originalname,
      pages: result.pages,
      text: result.text
    });

  } catch (error) {
    console.error("PDF extraction error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to extract text from the PDF."
    });
  }
});

module.exports = router;
