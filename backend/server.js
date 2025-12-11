require('dotenv').config();

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const upload = multer({ storage: multer.memoryStorage() });
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// GOOGLE CREDENTIALS FOR VERCEL
// ===============================
const googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : null;

if (!googleCreds) {
  console.error("❌ Missing GOOGLE_APPLICATION_CREDENTIALS_JSON in Vercel!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// ===============================
// GOOGLE VISION USING REST API
// ===============================
async function extractTextWithVision(base64Image) {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${googleCreds.private_key_id}`;

  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }]
      }
    ]
  };

  const response = await axios.post(url, body);
  return response.data.responses[0].fullTextAnnotation?.text || "";
}

// ===============================
// PROMPT
// ===============================
const INVOICE_GENERATION_PROMPT = `
Analyze the text and structure it into an invoice JSON with keys:
vendor, vendorAddress, client, clientAddress, invoiceNumber, date, dueDate, items, subtotal, tax, total.
Items must be an array of objects: description, quantity, unitPrice, total.
Empty fields = "" or 0.
Text: """{EXTRACTED_TEXT}""" 
JSON Output:
`;

// ===============================
// ROUTE
// ===============================
app.post('/api/process-image', upload.single('invoiceImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const base64Image = req.file.buffer.toString("base64");

    // 1️⃣ Extract text from the image
    const extractedText = await extractTextWithVision(base64Image);

    // 2️⃣ Generate structured invoice JSON
    const result = await model.generateContent(
      INVOICE_GENERATION_PROMPT.replace("{EXTRACTED_TEXT}", extractedText)
    );

    const responseText = result.response.text();
    res.json({ extractedText, invoice: JSON.parse(responseText) });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// SERVER
// ===============================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

