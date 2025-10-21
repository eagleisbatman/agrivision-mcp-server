/**
 * AgriVision MCP Server
 *
 * AI-powered plant disease and health diagnosis using Google Gemini vision models
 * via Model Context Protocol (MCP) StreamableHTTP
 *
 * Configurable modes:
 * - ADVISORY_MODE: diagnosis_only | full_advisory
 * - OUTPUT_FORMAT: structured | text
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';
const ADVISORY_MODE = process.env.ADVISORY_MODE || 'diagnosis_only'; // diagnosis_only | full_advisory
const OUTPUT_FORMAT = process.env.OUTPUT_FORMAT || 'structured'; // structured | text
const AGRICULTURE_API_URL = process.env.AGRICULTURE_API_URL || 'https://nong-tri-agriculture-api.up.railway.app';
const PORT = process.env.PORT || 3001;

// Warn if token is missing
if (!GEMINI_API_KEY) {
  console.warn('⚠️  WARNING: GEMINI_API_KEY environment variable is not set!');
  console.warn('⚠️  Server will start but diagnosis tool will not work until key is configured.');
}

// Initialize Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Fallback supported crops (used if Agriculture API is unavailable)
const FALLBACK_CROPS = [
  'maize', 'wheat', 'rice', 'sorghum', 'millet',
  'beans', 'cowpea', 'pigeon_pea', 'groundnut',
  'cassava', 'sweet_potato', 'potato',
  'tomato', 'cabbage', 'kale', 'onion', 'vegetables',
  'tea', 'coffee', 'sugarcane', 'banana', 'sunflower', 'cotton'
] as const;

// Dynamic supported crops (fetched from Agriculture API)
let SUPPORTED_CROPS: readonly string[] = FALLBACK_CROPS;

/**
 * Fetch all crops from the Agriculture API
 * Handles pagination to get all 36+ Vietnamese crops
 */
async function fetchCropsFromAgricultureAPI(): Promise<string[]> {
  try {
    // Ensure URL has protocol
    const apiUrl = AGRICULTURE_API_URL.startsWith('http')
      ? AGRICULTURE_API_URL
      : `https://${AGRICULTURE_API_URL}`;

    console.log('[Agriculture API] Fetching crops from:', apiUrl);

    const crops: string[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await fetch(`${apiUrl}/api/crops?page=${page}&limit=50`);

      if (!response.ok) {
        throw new Error(`Agriculture API returned status ${response.status}`);
      }

      const data: any = await response.json();

      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from Agriculture API');
      }

      // Convert crop names to AgriVision format (lowercase with underscores)
      const pageCrops = data.data.map((crop: any) =>
        crop.name
          .toLowerCase()
          .replace(/\s+/g, '_')        // Replace spaces with underscores
          .replace(/[()]/g, '')        // Remove parentheses
      );

      crops.push(...pageCrops);

      // Check if there are more pages
      if (data.pagination && data.pagination.page < data.pagination.totalPages) {
        page++;
      } else {
        hasMorePages = false;
      }
    }

    console.log(`[Agriculture API] ✅ Successfully fetched ${crops.length} crops`);
    console.log('[Agriculture API] Crops:', crops.slice(0, 10).join(', '), '...');

    return crops;

  } catch (error: any) {
    console.error('[Agriculture API] ❌ Failed to fetch crops:', error.message);
    console.error('[Agriculture API] Falling back to hardcoded crop list');
    return [...FALLBACK_CROPS];
  }
}

// Initialize crops on startup
(async () => {
  const fetchedCrops = await fetchCropsFromAgricultureAPI();
  SUPPORTED_CROPS = fetchedCrops;
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'agrivision-mcp-server',
    aiVisionConfigured: !!GEMINI_API_KEY,
    model: GEMINI_IMAGE_MODEL,
    advisoryMode: ADVISORY_MODE,
    outputFormat: OUTPUT_FORMAT,
    supportedCrops: SUPPORTED_CROPS.length,
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'AgriVision MCP Server',
    version: '1.0.0',
    description: `AI-powered plant disease and health diagnosis using Google Gemini ${GEMINI_IMAGE_MODEL}. Region-agnostic diagnostic service providing ${ADVISORY_MODE === 'full_advisory' ? 'diagnosis + treatment recommendations' : 'diagnostic data only'}. Output format: ${OUTPUT_FORMAT}.`,
    configuration: {
      model: GEMINI_IMAGE_MODEL,
      advisoryMode: ADVISORY_MODE,
      outputFormat: OUTPUT_FORMAT
    },
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST)'
    },
    tools: [
      'diagnose_plant_health'
    ],
    supportedCrops: SUPPORTED_CROPS.length
  });
});

// Main MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined // Stateless
    });

    const server = new McpServer({
      name: 'AgriVision',
      version: '1.0.0',
      description: `AI-powered plant health diagnosis using Gemini ${GEMINI_IMAGE_MODEL}. Mode: ${ADVISORY_MODE}. ${ADVISORY_MODE === 'full_advisory' ? 'Returns diagnosis + treatment recommendations.' : 'Returns diagnostic data only.'}`
    });

    // Tool: Diagnose Plant Health
    const toolDescription = ADVISORY_MODE === 'full_advisory'
      ? 'Analyzes plant images using AI vision to assess overall plant health. Identifies crop species, detects any issues (diseases/pests/deficiencies), and provides comprehensive diagnostic information WITH treatment recommendations. Returns: crop ID, health status (healthy or issues detected), symptoms, severity, AND treatment options (organic/chemical), application methods, preventive measures.'
      : 'Analyzes plant images using AI vision to assess overall plant health. Identifies crop species and detects any issues (diseases/pests/deficiencies). Returns ONLY diagnostic data (crop ID, health status - healthy or issues detected, symptoms, severity). Does NOT provide treatment recommendations - that should be handled by the calling agent based on region.';

    // Build crop enum dynamically from current SUPPORTED_CROPS
    const cropEnum = SUPPORTED_CROPS.length > 0
      ? z.enum(SUPPORTED_CROPS as [string, ...string[]])
      : z.string();

    server.tool(
      'diagnose_plant_health',
      toolDescription,
      {
        image: z.string().describe('Base64-encoded image of the plant (data:image/jpeg;base64,...). JPEG, PNG, or WebP. Max 5MB.'),
        crop: cropEnum.optional().describe(`Optional: Expected crop type to verify against image. If provided, tool will validate if image matches. Supported: ${SUPPORTED_CROPS.slice(0, 8).join(', ')}, etc. (${SUPPORTED_CROPS.length} crops total from Vietnamese Agriculture API)`)
      },
      async ({ image, crop }) => {
        try {
          console.log(`[MCP Tool] diagnose_plant_health called${crop ? ` for crop: ${crop}` : ''}`);

          // Check if Gemini is configured
          if (!genAI) {
            return {
              content: [{
                type: 'text',
                text: '❌ Plant diagnosis service is currently unavailable. Please try again later.'
              }],
              isError: true
            };
          }

          // Validate image data
          if (!image || image.length === 0) {
            return {
              content: [{
                type: 'text',
                text: 'Please provide an image of the plant for diagnosis.'
              }],
              isError: true
            };
          }

          // Extract image format and data from base64 string
          const base64Match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
          if (!base64Match) {
            return {
              content: [{
                type: 'text',
                text: 'Invalid image format. Please provide a JPEG, PNG, or WebP image in base64 format (data:image/jpeg;base64,...).'
              }],
              isError: true
            };
          }

          const mimeType = `image/${base64Match[1]}`;
          const imageData = base64Match[2];

          // Check image size
          const imageSizeBytes = (imageData.length * 3) / 4;
          const imageSizeMB = imageSizeBytes / (1024 * 1024);

          if (imageSizeMB > 5) {
            return {
              content: [{
                type: 'text',
                text: `Image is too large (${imageSizeMB.toFixed(1)}MB). Please provide an image smaller than 5MB.`
              }],
              isError: true
            };
          }

          console.log(`[AI Vision] Analyzing image (${imageSizeMB.toFixed(2)}MB, ${mimeType})${crop ? ` for ${crop}` : ''}`);
          console.log(`[AI Vision] Using model: ${GEMINI_IMAGE_MODEL}`);

          // Initialize Gemini model
          const model = genAI.getGenerativeModel({
            model: GEMINI_IMAGE_MODEL,
            generationConfig: {
              temperature: 0.4,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 2048, // Increased for detailed diagnostic reports
            }
          });

          // Construct prompt based on advisory mode
          const cropContext = crop
            ? `The plant is expected to be ${crop.replace('_', ' ')}. Verify if the image matches this crop type.`
            : 'Identify the plant/crop species from the image.';

          // Base diagnostic sections (always included)
          let promptSections = `You are an expert agricultural pathologist. Analyze this plant image and provide a ${OUTPUT_FORMAT === 'structured' ? 'structured' : 'detailed'} report.

${cropContext}

Provide your analysis in the following ${OUTPUT_FORMAT === 'structured' ? 'structured format' : 'format'}:

🌱 **CROP IDENTIFICATION:**
[Identify the crop/plant species with confidence level (High/Medium/Low)]
[If crop was specified but doesn't match: clearly state the mismatch]
[Format: "Crop: [Name] (Scientific: [Latin name]) - Confidence: [level]"]

🔍 **HEALTH STATUS:**
[Overall health: Healthy / Mild Issue / Moderate Issue / Severe Issue / Critical]
[Confidence: High / Medium / Low]

⚠️ **ISSUE DETECTION:**
[If issues detected, list each one separately:]

**Issue 1: [Disease/Pest/Deficiency Name]**
- Scientific name: [Latin name if applicable]
- Category: [Disease/Pest/Nutrient Deficiency/Physical Damage/Other]
- Severity: [Low/Moderate/High/Critical]
- Stage: [Early/Active/Advanced]
- Affected parts: [Leaves/Stem/Roots/Fruit/Flowers/Entire plant]
- Visible symptoms: [Detailed list of what you observe]
- Causal agent: [Fungus/Bacteria/Virus/Insect/Mite/Environmental/Unknown]

[Repeat for each issue detected]

📊 **GROWTH STAGE:**
[Seedling/Vegetative/Flowering/Fruiting/Mature/Senescent]

🔬 **DIAGNOSTIC NOTES:**
[Additional observations, differential diagnosis if multiple possibilities, uncertainty notes]`;

          // Add treatment section if in full_advisory mode
          if (ADVISORY_MODE === 'full_advisory') {
            promptSections += `

💊 **TREATMENT RECOMMENDATIONS:**
[For each detected issue, provide treatment guidance:]

**Treatment for Issue 1: [Issue Name]**

*Organic Options:*
- Option 1: [Treatment name/method]
  - Application: [How to apply]
  - Frequency: [How often]
  - Timing: [When to apply]
- Option 2: [Alternative organic treatment]

*Chemical Options:*
- Product 1: [Active ingredient/product type]
  - Application: [How to apply]
  - Dosage: [General dosage guidance]
  - Safety: [Key safety precautions]
- Product 2: [Alternative chemical treatment]

*Preventive Measures:*
- [Cultural practices to prevent recurrence]
- [Environmental management]
- [Crop rotation/spacing recommendations]

[Repeat for each issue]

⚠️ **IMPORTANT NOTES:**
- Always consult local agricultural extension services for region-specific product recommendations
- Follow all product label instructions and safety guidelines
- Consider integrated pest management (IPM) approaches
- Monitor plant response and adjust treatment as needed`;
          }

          // Add formatting rules
          const formattingRules = OUTPUT_FORMAT === 'structured'
            ? `

IMPORTANT RULES:
- Be specific about disease/pest names (use both common and scientific names)
- If image is unclear or doesn't show a plant, state this clearly
- If uncertain, provide confidence levels and alternative possibilities
- Use precise botanical and pathological terminology
- Maintain structured format with clear sections
- ${ADVISORY_MODE === 'diagnosis_only' ? 'Focus ONLY on diagnosis - NO treatment recommendations, NO regional advice' : 'Provide comprehensive treatment guidance with multiple options'}
- Indicate if further laboratory testing is recommended for confirmation`
            : `

IMPORTANT RULES:
- Be specific about disease/pest names (use both common and scientific names)
- If image is unclear or doesn't show a plant, state this clearly
- If uncertain, provide confidence levels and alternative possibilities
- Use clear, readable formatting with appropriate spacing
- ${ADVISORY_MODE === 'diagnosis_only' ? 'Focus ONLY on diagnosis - NO treatment recommendations, NO regional advice' : 'Provide comprehensive treatment guidance in a farmer-friendly format'}
- Indicate if further laboratory testing is recommended for confirmation`;

          const prompt = promptSections + formattingRules;

          // Call Gemini API
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                mimeType: mimeType,
                data: imageData
              }
            }
          ]);

          const response = result.response;
          const diagnosis = response.text();

          console.log('[AI Vision] Diagnosis completed successfully');

          return {
            content: [{
              type: 'text',
              text: diagnosis
            }]
          };

        } catch (error: any) {
          console.error('[MCP Tool] Error in diagnose_plant_health:', error.message);

          if (error.message?.includes('API key')) {
            return {
              content: [{
                type: 'text',
                text: '❌ Plant diagnosis service configuration error. Please contact support.'
              }],
              isError: true
            };
          }

          if (error.message?.includes('quota')) {
            return {
              content: [{
                type: 'text',
                text: '❌ Plant diagnosis service is temporarily unavailable due to high demand. Please try again later.'
              }],
              isError: true
            };
          }

          return {
            content: [{
              type: 'text',
              text: 'Unable to analyze the plant image. Please ensure the image clearly shows the plant and try again.'
            }],
            isError: true
          };
        }
      }
    );

    // Connect and handle the request
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

  } catch (error) {
    console.error('[MCP] Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : 'Unknown error'
      },
      id: null
    });
  }
});

// Start server
const HOST = '0.0.0.0';
app.listen(Number(PORT), HOST, () => {
  console.log('');
  console.log('🚀 =========================================');
  console.log('   AgriVision MCP Server');
  console.log('   AI-Powered Plant Health Diagnosis');
  console.log('=========================================');
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌿 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log('');
  console.log('🤖 AI Vision Configuration:');
  console.log(`   Model: ${GEMINI_IMAGE_MODEL}`);
  console.log(`   API Key: ${GEMINI_API_KEY ? '✅ Configured' : '⚠️  NOT CONFIGURED'}`);
  console.log('');
  console.log('⚙️  Service Configuration:');
  console.log(`   Advisory Mode: ${ADVISORY_MODE}`);
  console.log(`   ${ADVISORY_MODE === 'full_advisory' ? '   → Returns diagnosis + treatment recommendations' : '   → Returns diagnostic data only'}`);
  console.log(`   Output Format: ${OUTPUT_FORMAT}`);
  console.log(`   ${OUTPUT_FORMAT === 'structured' ? '   → Structured format with clear sections' : '   → Formatted text with enhanced readability'}`);
  console.log('');
  console.log(`🌾 Supported crops: ${SUPPORTED_CROPS.length}`);
  console.log('=========================================');
  console.log('');
});
