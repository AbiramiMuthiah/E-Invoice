require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// 1. Safe Credential Loading (No keys written here!)
let googleCreds;
try {
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    googleCreds = JSON.parse(rawJson);
} catch (e) {
    console.error("❌ Credentials Error: Ensure you added them to Render/Vercel settings.");
    process.exit(1);
}

// 2. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// 3. Vision Extraction Function
async function extractTextWithVision(base64Image) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const body = {
        requests: [{
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION" }]
        }]
    };

    const response = await axios.post(url, body);
    return response.data.responses[0]?.fullTextAnnotation?.text || "No text found";
}

// 4. Prompt
const INVOICE_PROMPT = `Extract invoice data as JSON with keys: vendor, client, total. Text: """{EXTRACTED_TEXT}"""`;

// 5. Route
app.post('/api/process-image', upload.single('invoiceImage'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });
        const base64Image = req.file.buffer.toString("base64");
        const extractedText = await extractTextWithVision(base64Image);
        const result = await model.generateContent(INVOICE_PROMPT.replace("{EXTRACTED_TEXT}", extractedText));
        res.json({ extractedText, invoice: JSON.parse(result.response.text().replace(/```json|```/g, "")) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));