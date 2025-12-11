require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');

// Google Cloud Vision
const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Gemini
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ===============================================
// ✅ LOAD GOOGLE CREDENTIALS FROM ENV VARIABLE
// ===============================================
let visionClient;
try {
  const googleCreds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

  visionClient = new ImageAnnotatorClient({
    credentials: {
      client_email: googleCreds.client_email,
      private_key: googleCreds.private_key,
    },
    projectId: googleCreds.project_id,
  });

  console.log("✅ Google Vision client initialized.");
} catch (error) {
  console.error("❌ Could not initialize Google Vision:", error);
  process.exit(1);
}

// ===============================================
// ✅ LOAD GEMINI
// ===============================================
let genAI, model;
try {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  // Latest correct model name
  model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  console.log("✅ Gemini initialized.");
} catch (error) {
  console.error("❌ Could not initialize Gemini:", error);
  process.exit(1);
}

// ===============================================
// PROCESS INVOICE API
// ===============================================

const INVOICE_GENERATION_PROMPT = `
Analyze the text and structure it as a JSON object for an invoice with keys:
vendor, vendorAddress, client, clientAddress, invoiceNumber, date, dueDate,
items, subtotal, tax, total.

Items must be an array with:
description, quantity, unitPrice, total.

Use "" for missing text and 0 for missing numbers.

Text: """{EXTRACTED_TEXT}"""
JSON Output:
`;

app.post('/api/process-image', upload.single('invoiceImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // ====== Google Vision OCR ======
    const [result] = await visionClient.textDetection(req.file.buffer);
    const text = result.fullTextAnnotation ? result.fullTextAnnotation.text : "";

    console.log("📄 Extracted Text:", text.substring(0, 200), "...");

    // ====== Gemini Parsing ======
    const prompt = INVOICE_GENERATION_PROMPT.replace("{EXTRACTED_TEXT}", text);

    const geminiResult = await model.generateContent(prompt);
    const responseText = geminiResult.response.text();

    console.log("🤖 Gemini Output:", responseText);

    // Try parsing JSON safely
    let invoiceJson;
    try {
      invoiceJson = JSON.parse(responseText);
    } catch (e) {
      return res.status(200).json({
        error: "Gemini returned invalid JSON",
        rawResponse: responseText,
      });
    }

    return res.json({
      extractedText: text,
      structuredData: invoiceJson,
    });

  } catch (error) {
    console.error("❌ Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ===============================================
// START SERVER
// ===============================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
