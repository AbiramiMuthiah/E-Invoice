require('dotenv').config();

const express = require('express');
const multer = require('multer');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

/* ============================================================
   🔥 GOOGLE CLOUD VISION – VERCEL FIX
   We load credentials from the Vercel env variable:
   GOOGLE_APPLICATION_CREDENTIALS_JSON
   ============================================================ */

let visionClient, genAI, model;

try {
  // --- Load Google Vision Credentials from ENV (Vercel compatible)
  const googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    : null;

  if (!googleCreds) {
    throw new Error("Google Vision credentials missing! Add GOOGLE_APPLICATION_CREDENTIALS_JSON in Vercel.");
  }

  visionClient = new ImageAnnotatorClient({
    credentials: googleCreds,
    projectId: googleCreds.project_id
  });

  // --- Gemini API
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing! Add it in Vercel.");
  }

  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

  console.log('✅ Google AI clients initialized successfully.');
} catch (error) {
  console.error('❌ FATAL ERROR:', error.message);
  process.exit(1);
}

/* ============================================================
   PROMPT
   ============================================================ */

const INVOICE_GENERATION_PROMPT = `
  Analyze the text and structure it as a JSON object for an invoice with keys: vendor, vendorAddress, client, clientAddress, invoiceNumber, date, dueDate, items, subtotal, tax, total. 'items' must be an array of objects with keys: description, quantity, unitPrice, total. Use "" for missing text and 0 for missing numbers. Text: """{EXTRACTED_TEXT}""" JSON Output:
`;

/* ============================================================
   ROUTES
   ============================================================ */

app.post('/api/process-image', upload.single('invoiceImage'), async (req, res) => {
  // your existing code goes here (unchanged)
});

/* ============================================================
   START SERVER
   ============================================================ */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
);
