/**
 * GAP Plant Diagnosis MCP Server
 *
 * Provides plant disease diagnosis using Google Gemini 2.5 Flash vision model
 * via Model Context Protocol (MCP) StreamableHTTP
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamable-http.js';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Environment variables
const PORT = parseInt(process.env.PORT || '3001', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: ALLOWED_ORIGINS === '*' ? '*' : ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increased for base64 images

// Initialize Gemini AI
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log('[Gemini] API initialized successfully');
} else {
  console.warn('[Gemini] ⚠️  GEMINI_API_KEY not set - diagnosis tool will not work');
}

// Initialize MCP server
const server = new Server(
  {
    name: 'gap-plant-diagnosis',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

/**
 * Supported crops in East Africa
 */
const SUPPORTED_CROPS = [
  'maize', 'wheat', 'rice', 'sorghum', 'millet',
  'beans', 'cowpea', 'pigeon_pea', 'groundnut',
  'cassava', 'sweet_potato', 'potato',
  'tomato', 'cabbage', 'kale', 'onion', 'vegetables',
  'tea', 'coffee', 'sugarcane', 'banana', 'sunflower', 'cotton'
] as const;

/**
 * Plant Disease Diagnosis Tool
 *
 * Analyzes plant images using Gemini 2.5 Flash to identify:
 * - Plant species (if crop not specified)
 * - Diseases and symptoms
 * - Pest infestations
 * - Nutrient deficiencies
 * - Treatment recommendations
 */
server.tool(
  'diagnose_plant_disease',
  'Diagnose plant diseases, pests, and health issues from images using AI vision analysis',
  {
    image: z.string().describe('Base64-encoded image of the plant (JPEG, PNG, WebP). Max 1MB.'),
    crop: z.enum(SUPPORTED_CROPS).optional().describe('Crop type (optional, helps improve accuracy)')
  },
  async ({ image, crop }) => {
    try {
      console.log(`[MCP Tool] diagnose_plant_disease called${crop ? ` for crop: ${crop}` : ''}`);

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
      // Expected format: data:image/jpeg;base64,/9j/4AAQ...
      const base64Match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
      if (!base64Match) {
        return {
          content: [{
            type: 'text',
            text: 'Invalid image format. Please provide a JPEG, PNG, or WebP image.'
          }],
          isError: true
        };
      }

      const mimeType = `image/${base64Match[1]}`;
      const imageData = base64Match[2];

      // Check image size (approximate, base64 is ~1.33x original size)
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

      console.log(`[Gemini] Analyzing image (${imageSizeMB.toFixed(2)}MB, ${mimeType})${crop ? ` for ${crop}` : ''}`);

      // Initialize Gemini 2.5 Flash model for vision tasks
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
        }
      });

      // Construct comprehensive prompt for plant diagnosis
      const cropContext = crop
        ? `The plant is identified as ${crop.replace('_', ' ')}. Focus your analysis on common diseases, pests, and issues specific to ${crop.replace('_', ' ')} in East African farming conditions.`
        : 'First, identify the plant species. Then analyze its health.';

      const prompt = `You are an expert agricultural pathologist specializing in East African crops. Analyze this plant image and provide a comprehensive diagnosis.

${cropContext}

Provide your analysis in the following structured format:

🌱 **Plant Identification:**
[If crop not specified: Identify the plant species with confidence level]
[If crop specified: Confirm if image matches the specified crop]

🔍 **Health Assessment:**
- Overall plant health: [Healthy/Mild Issue/Moderate Issue/Severe Issue]
- Confidence level: [High/Medium/Low]

⚠️ **Diagnosis:**
[List any diseases, pests, or issues detected. For each, provide:]
- Issue name (common and scientific if applicable)
- Severity level
- Affected plant parts
- Key visible symptoms

💊 **Treatment Recommendations:**
[Provide 3-4 actionable treatment steps, prioritized]
1. [Immediate action]
2. [Short-term treatment]
3. [Preventive measures]
4. [When to seek expert help]

🌾 **Farmer-Friendly Summary:**
[2-3 sentences in simple language explaining what's wrong and what to do]

Important guidelines:
- Be specific about diseases/pests (don't just say "disease" - name it)
- If the image is unclear or doesn't show a plant, say so
- If you're uncertain, indicate that and suggest consulting an agricultural extension officer
- Focus on treatments available to East African farmers (affordable, locally available)
- Use simple language farmers can understand
- Include both organic and chemical treatment options when applicable`;

      // Call Gemini API with image and prompt
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

      console.log('[Gemini] Diagnosis completed successfully');

      // Return diagnosis result
      return {
        content: [{
          type: 'text',
          text: diagnosis
        }]
      };

    } catch (error: any) {
      console.error('[MCP Tool] Error in diagnose_plant_disease:', error.message);

      // Handle specific Gemini API errors
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'gap-plant-diagnosis-mcp',
    geminiConfigured: !!GEMINI_API_KEY,
    supportedCrops: SUPPORTED_CROPS.length,
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - server info
app.get('/', (req, res) => {
  res.json({
    service: 'GAP Plant Diagnosis MCP Server',
    version: '1.0.0',
    description: 'Plant disease diagnosis using Google Gemini 2.5 Flash vision model',
    mcp_endpoint: '/mcp',
    health_endpoint: '/health',
    tools: [
      {
        name: 'diagnose_plant_disease',
        description: 'Diagnose plant diseases, pests, and health issues from images',
        parameters: {
          image: 'Base64-encoded image (JPEG, PNG, WebP, max 5MB)',
          crop: `Optional crop type (${SUPPORTED_CROPS.length} supported crops)`
        }
      }
    ],
    supported_crops: SUPPORTED_CROPS,
    powered_by: 'Google Gemini 2.5 Flash'
  });
});

// MCP endpoint using StreamableHTTP transport
app.post('/mcp', async (req, res) => {
  try {
    console.log('[MCP] Incoming request');

    const transport = new StreamableHTTPServerTransport({
      endpoint: '/mcp',
      server
    });

    await transport.handle(req, res);
  } catch (error: any) {
    console.error('[MCP] Error handling request:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 =========================================');
  console.log('   GAP Plant Diagnosis MCP Server');
  console.log('=========================================');
  console.log(`✅ Server running on 0.0.0.0:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌿 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`🔑 Gemini API Key: ${GEMINI_API_KEY ? '✅ Configured' : '⚠️  NOT CONFIGURED'}`);
  console.log(`🌾 Supported crops: ${SUPPORTED_CROPS.length}`);
  console.log('=========================================');
  console.log('');
});
