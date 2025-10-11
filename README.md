# GAP Plant Diagnosis MCP Server

**Plant disease diagnosis using Google Gemini 2.5 Flash vision model via Model Context Protocol (MCP).**

## Overview

This MCP server provides AI-powered plant disease diagnosis for East African farmers. It uses Google's Gemini 2.5 Flash vision model to analyze plant images and identify:

- Plant species (if not specified)
- Diseases and symptoms
- Pest infestations
- Nutrient deficiencies
- Treatment recommendations

## Features

- 🌿 **AI-Powered Diagnosis**: Uses Gemini 2.5 Flash for accurate plant health analysis
- 🌾 **22 Supported Crops**: All major East African crops supported
- 📸 **Image Analysis**: Base64 image input (JPEG, PNG, WebP, max 5MB)
- 🔬 **Comprehensive Reports**: Species ID, health assessment, diagnosis, treatment recommendations
- 🌍 **East Africa Focus**: Treatments and advice tailored for local farming conditions
- 🚀 **MCP Protocol**: Integrates with OpenAI Agent Builder workflows

## Supported Crops

**Cereals & Grains:** maize, wheat, rice, sorghum, millet
**Legumes:** beans, cowpea, pigeon_pea, groundnut
**Root Crops:** cassava, sweet_potato, potato
**Vegetables:** tomato, cabbage, kale, onion, vegetables (general)
**Cash Crops:** tea, coffee, sugarcane, banana, sunflower, cotton

## Installation

```bash
# Clone repository
git clone <repository-url>
cd gap-plant-diagnosis-mcp

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your Gemini API key to .env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# Google AI (Gemini) API Key (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=*
```

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to your `.env` file

## Usage

### Development

```bash
npm run dev
```

Server starts on http://localhost:3001

### Production

```bash
npm run build
npm start
```

### Testing

```bash
# Health check
curl http://localhost:3001/health

# Server info
curl http://localhost:3001/
```

## MCP Tool: diagnose_plant_disease

### Parameters

- **image** (required): Base64-encoded plant image
  - Format: `data:image/jpeg;base64,/9j/4AAQ...`
  - Supported formats: JPEG, PNG, WebP
  - Max size: 5MB

- **crop** (optional): Crop type for better accuracy
  - Examples: `maize`, `tomato`, `coffee`
  - See supported crops list above

### Response Format

```
🌱 Plant Identification:
[Species identification and confirmation]

🔍 Health Assessment:
- Overall plant health: [Healthy/Mild/Moderate/Severe]
- Confidence level: [High/Medium/Low]

⚠️ Diagnosis:
[Detected diseases, pests, or issues with details]

💊 Treatment Recommendations:
1. [Immediate action]
2. [Short-term treatment]
3. [Preventive measures]
4. [When to seek expert help]

🌾 Farmer-Friendly Summary:
[Simple explanation and action steps]
```

### Example Usage in Agent Builder

When integrated with OpenAI Agent Builder, the LLM can call this tool:

```typescript
diagnose_plant_disease({
  image: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  crop: "maize"
})
```

The response will be formatted for farmers in simple, actionable language.

## Integration with FarmerChat

### 1. Deploy to Railway (or similar platform)

```bash
# Deploy to Railway
railway login
railway link
railway up
```

### 2. Add to OpenAI Agent Builder

1. Go to platform.openai.com
2. Navigate to your FarmerChat workflow
3. Add new MCP connection:
   - Name: Plant Diagnosis
   - URL: https://your-deployment-url/mcp
   - Type: StreamableHTTP
4. Save workflow

### 3. Update System Prompt

Add to SYSTEM_PROMPT.md:

```markdown
## Image-Based Plant Diagnosis

When users share plant images, use the `diagnose_plant_disease` tool to:
- Identify plant species (if unknown)
- Detect diseases, pests, nutrient deficiencies
- Provide treatment recommendations

Instructions:
- Request image upload when users mention plant health issues
- Always pass crop type if known for better accuracy
- Present diagnosis in simple, farmer-friendly language
- Focus on locally available, affordable treatments
```

## API Endpoints

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "gap-plant-diagnosis-mcp",
  "geminiConfigured": true,
  "supportedCrops": 22,
  "version": "1.0.0",
  "timestamp": "2025-10-11T..."
}
```

### GET /

Server information and capabilities.

### POST /mcp

MCP protocol endpoint for tool calls.

## Project Structure

```
gap-plant-diagnosis-mcp/
├── src/
│   └── index.ts           # Main server with MCP tool implementation
├── dist/                  # Compiled JavaScript (generated)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Error Handling

The tool handles various error scenarios:

- **No API key**: Returns configuration error
- **Invalid image format**: Requests valid JPEG/PNG/WebP
- **Image too large**: Requests smaller image (< 5MB)
- **API quota exceeded**: Informs user of temporary unavailability
- **Unclear image**: Requests clearer image showing plant
- **Non-plant image**: Indicates image doesn't show a plant

All errors are returned in farmer-friendly language.

## Deployment

### Railway Deployment

1. Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

2. Set environment variables in Railway dashboard:
   - `GEMINI_API_KEY`
   - `PORT` (Railway sets automatically)
   - `NODE_ENV=production`

3. Deploy:
```bash
railway up
```

### Other Platforms

Compatible with any platform supporting Node.js:
- Vercel
- Render
- Fly.io
- Heroku
- Digital Ocean App Platform

## Development Guidelines

### Adding New Features

1. **New crop support**: Add to `SUPPORTED_CROPS` array
2. **Enhanced diagnosis**: Modify Gemini prompt in tool handler
3. **Additional tools**: Use `server.tool()` to add new MCP tools

### Testing with Sample Images

Create a test script to send base64 images:

```typescript
// test-diagnosis.ts
const fs = require('fs');
const imageBuffer = fs.readFileSync('plant.jpg');
const base64Image = imageBuffer.toString('base64');
const dataURI = `data:image/jpeg;base64,${base64Image}`;

// Send to MCP endpoint via Agent Builder or direct MCP client
```

## Troubleshooting

**Tool not working:**
- Check `GEMINI_API_KEY` is set correctly
- Verify image is valid base64 with proper data URI format
- Check image size is under 5MB
- Review Railway logs for errors

**Low accuracy:**
- Ensure image clearly shows affected plant parts
- Provide crop type parameter for better context
- Use high-resolution images
- Capture close-ups of symptoms

**Quota errors:**
- Check Gemini API quota limits
- Upgrade to paid tier if needed
- Implement rate limiting if necessary

## License

MIT

## Related Projects

- **gap-mcp-server**: Weather and farming advisory MCP server
- **gap-chat-widget**: FarmerChat UI with ChatKit integration

## Support

For issues and questions, contact Digital Green Foundation or open an issue in the repository.
