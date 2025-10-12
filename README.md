# AgriVision MCP Server

**AI-Powered Plant Disease & Health Diagnosis via Model Context Protocol**

AgriVision is a region-agnostic plant health diagnosis service providing structured diagnostic data through MCP. Uses Google Gemini 2.5 Flash for accurate crop disease detection, pest identification, and nutrient deficiency analysis.

[![Model](https://img.shields.io/badge/Model-Gemini%202.5%20Flash-blue)](https://ai.google.dev/gemini-api/docs/models/gemini)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

---

## 🌟 Features

- **AI Vision Analysis**: Powered by Google Gemini 2.5 Flash (configurable)
- **23 Supported Crops**: Cereals, legumes, vegetables, cash crops
- **Disease Detection**: Fungal, bacterial, viral with scientific names
- **Pest Identification**: Insects, mites, infestations
- **Nutrient Analysis**: Deficiency detection
- **Growth Stage Assessment**: Seedling to senescent
- **Configurable Modes**: Diagnosis-only or full advisory
- **Structured Output**: JSON or formatted text
- **Region-Agnostic**: Adaptable to any geography

---

## 🤖 AI Model: Google Gemini 2.5 Flash

| Aspect | Details |
|--------|---------|
| Provider | Google AI |
| Model | gemini-2.5-flash-image-preview |
| Specialization | Vision + Language |
| Strengths | Fast, accurate on plant images |
| Output Tokens | Up to 2048 |

**Alternative Models**: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash
Configure via `GEMINI_IMAGE_MODEL` environment variable.

---

## 🚀 Quick Start

```bash
git clone https://github.com/eagleisbatman/agrivision-mcp-server.git
cd agrivision-mcp-server
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm run dev
```

Get API Key: https://makersuite.google.com/app/apikey

---

## ⚙️ Configuration

### Required
```bash
GEMINI_API_KEY=your_key_here
```

### Advisory Mode (Important!)
```bash
ADVISORY_MODE=diagnosis_only  # or "full_advisory"
```

- **diagnosis_only** (default): Returns diagnostic data only. Client agent generates region-specific treatment.
- **full_advisory**: Returns diagnosis + AI treatment recommendations.

### Output Format
```bash
OUTPUT_FORMAT=structured  # or "text"
```

- **structured** (default): JSON with typed fields
- **text**: Formatted text with emojis

### Model Selection
```bash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image-preview
```

---

## 🔌 API Endpoints

### GET /health
```json
{
  "status": "healthy",
  "model": "gemini-2.5-flash-image-preview",
  "advisoryMode": "diagnosis_only",
  "supportedCrops": 23
}
```

### POST /mcp
MCP protocol endpoint for tool calls.

---

## 🛠️ MCP Tool: diagnose_plant_health

### Parameters
- `image` (required): Base64-encoded image (`data:image/jpeg;base64,...`)
- `crop` (optional): Expected crop type (e.g., `maize`, `tomato`)

### Supported Crops (23)
Cereals: maize, wheat, rice, sorghum, millet
Legumes: beans, cowpea, pigeon_pea, groundnut
Roots: cassava, sweet_potato, potato
Vegetables: tomato, cabbage, kale, onion
Cash Crops: tea, coffee, sugarcane, banana, sunflower, cotton

### Response (diagnosis_only + structured)
```json
{
  "crop": {"name": "Maize", "scientific_name": "Zea mays", "confidence": "High"},
  "health_status": {"overall": "Moderate Issue", "confidence": "High"},
  "issues": [{
    "name": "Fall Armyworm",
    "scientific_name": "Spodoptera frugiperda",
    "category": "Pest",
    "severity": "Moderate",
    "symptoms": ["Irregular holes", "Frass visible"]
  }],
  "growth_stage": "Vegetative"
}
```

---

## 🌍 Region-Agnostic Design

Diagnostic data uses scientific terminology. Client agents add regional context.

**Architecture:**
```
Image → AgriVision (diagnosis_only) → Agent Builder → Region-specific advice
```

**Example**: Same diagnosis, different regions:
- Kenya: "Use Neem oil from local agro-dealer"
- India: "Apply Bt from Krishi Bhawan"
- USA: "Use recommended Bt from ag store"

---

## 📦 Deploy to Railway

1. Push to GitHub
2. Create project on railway.app from GitHub repo
3. Set environment variables:
   - GEMINI_API_KEY
   - ADVISORY_MODE=diagnosis_only
   - OUTPUT_FORMAT=structured
4. Deploy automatically
5. Test: `curl https://your-app.up.railway.app/health`

---

## 🔗 OpenAI Agent Builder Integration

1. Add MCP connection:
   - URL: `https://your-app.up.railway.app/mcp`
   - Type: StreamableHTTP

2. System Prompt:
```markdown
When users share images, use `diagnose_plant_disease` tool.
Tool returns diagnostic data only.
YOU must generate region-specific treatment advice.
```

---

## 🧪 Testing

```bash
node test-diagnosis.js /path/to/image.jpg
```

---

## 📄 License

MIT - Built with ❤️ by Digital Green Foundation

---

**Support**: GitHub Issues or support@digitalgreen.org
