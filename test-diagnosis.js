/**
 * Test script for Gemini Plant Diagnosis MCP Server
 * Sends a plant image to the MCP server and displays the diagnosis
 */

import fs from 'fs';
import path from 'path';

const MCP_ENDPOINT = 'http://localhost:3001/mcp';

// Get image path from command line or use first image in S3_IMAGES
const imagePath = process.argv[2] || '/Users/eagleisbatman/Desktop/S3_IMAGES/00006eb7-221e-486c-8513-9f0a4da47635_image_input.jpg';

console.log('🧪 Testing Gemini Plant Diagnosis MCP Server');
console.log('============================================');
console.log(`📸 Image: ${path.basename(imagePath)}`);
console.log(`🌐 Endpoint: ${MCP_ENDPOINT}`);
console.log('');

// Read image and convert to base64
try {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataURI = `data:${mimeType};base64,${base64Image}`;

  console.log(`📊 Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`🔢 Base64 length: ${base64Image.length} characters`);
  console.log('');

  // Prepare MCP request
  const mcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'diagnose_plant_disease',
      arguments: {
        image: dataURI,
        crop: 'maize' // Optional: specify crop for better accuracy
      }
    }
  };

  console.log('📤 Sending diagnosis request...');
  console.log('');

  // Send request to MCP server
  fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify(mcpRequest)
  })
    .then(async response => {
      const contentType = response.headers.get('content-type');

      // Handle server-sent events (streaming response)
      if (contentType && contentType.includes('text/event-stream')) {
        console.log('✅ Receiving streamed response...');
        console.log('');

        const text = await response.text();
        const lines = text.split('\n');
        let jsonData = '';

        // Parse SSE format: extract JSON from data: lines
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            jsonData += line.substring(6);
          }
        }

        if (jsonData) {
          const data = JSON.parse(jsonData);
          console.log('📋 DIAGNOSIS RESULT:');
          console.log('============================================');

          if (data.error) {
            console.error('❌ Error:', data.error.message);
          } else if (data.result && data.result.content && data.result.content[0]) {
            console.log(data.result.content[0].text);
          } else {
            console.log('Unexpected response format:', JSON.stringify(data, null, 2));
          }

          console.log('');
          console.log('============================================');
        }
      } else {
        // Handle JSON response
        const data = await response.json();
        console.log('✅ Response received!');
        console.log('');
        console.log('📋 DIAGNOSIS RESULT:');
        console.log('============================================');

        if (data.error) {
          console.error('❌ Error:', data.error.message);
        } else if (data.result && data.result.content && data.result.content[0]) {
          console.log(data.result.content[0].text);
        } else {
          console.log('Unexpected response format:', JSON.stringify(data, null, 2));
        }

        console.log('');
        console.log('============================================');
      }
    })
    .catch(error => {
      console.error('❌ Request failed:', error.message);
    });

} catch (error) {
  console.error('❌ Error reading image:', error.message);
  console.log('');
  console.log('Usage: node test-diagnosis.js [path-to-image.jpg]');
  console.log('Example: node test-diagnosis.js /Users/eagleisbatman/Desktop/S3_IMAGES/image.jpg');
}
