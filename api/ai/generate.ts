/**
 * CL — AI Generation Serverless Function
 * Vercel Edge Function: POST /api/ai/generate
 *
 * This function runs SERVER-SIDE on Vercel.
 * The OPENAI_API_KEY is a server-side env var — NEVER exposed to the browser.
 *
 * Request body: AIGenerationInput
 * Response: AIGenerationOutput (JSON)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface GenerationInput {
  toolType: 'hooks' | 'scripts' | 'captions' | 'ideas' | 'angles' | 'calendar'
  companyName: string
  industry: string
  description?: string
  targetAudience?: string
  productService?: string
  goal?: string
  platform?: string
  tone?: string
  count?: number
  clientId?: string
}

function buildPrompt(input: GenerationInput): string {
  const base = `You are a senior creative strategist at a top-tier social media marketing agency. You specialize in short-form video content for brands across the Middle East and globally.

Brand Context:
- Company: ${input.companyName}
- Industry: ${input.industry}
- Description: ${input.description ?? 'Not provided'}
- Target Audience: ${input.targetAudience ?? 'Not specified'}
- Product/Service Focus: ${input.productService ?? input.companyName}
- Goal: ${input.goal ?? 'Brand awareness'}
- Platform: ${input.platform ?? 'Instagram Reels'}
- Tone: ${input.tone ?? 'Professional and engaging'}
- Count: Generate ${input.count ?? 5} items`

  switch (input.toolType) {
    case 'hooks':
      return `${base}

Generate exactly ${input.count ?? 5} powerful video hooks for this brand. Each hook should:
- Be 1-2 sentences maximum
- Immediately grab attention in the first 3 seconds
- Be specific to this industry and brand
- Use different psychological triggers (curiosity, FOMO, social proof, bold claim, question, etc.)

Respond with valid JSON:
{
  "hooks": [
    { "text": "...", "type": "curiosity|fomo|social_proof|bold_claim|question|pain_point", "explanation": "Why this works for this brand" }
  ]
}`

    case 'scripts':
      return `${base}

Generate exactly ${input.count ?? 3} complete reel scripts for this brand. Each script must include:
- A powerful hook (opening 3 seconds)
- Scene-by-scene breakdown with visuals + voiceover
- On-screen text suggestions
- A clear CTA
- Instagram caption
- Hashtags

Respond with valid JSON:
{
  "scripts": [
    {
      "title": "...",
      "hook": "...",
      "scenes": [
        { "time": "0:00-0:05", "visual": "...", "voiceover": "...", "text": "..." }
      ],
      "cta": "...",
      "shotList": ["Shot 1...", "Shot 2..."],
      "caption": "...",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}`

    case 'captions':
      return `${base}

Generate exactly ${input.count ?? 5} high-converting social media captions for this brand.

Respond with valid JSON:
{
  "captions": [
    {
      "main": "Full caption with emojis and line breaks...",
      "short": "Under 150 char version for Stories...",
      "hashtags": ["#tag1", "#tag2", "#tag3"]
    }
  ]
}`

    case 'ideas':
      return `${base}

Generate exactly ${input.count ?? 5} detailed content ideas for this brand.

Respond with valid JSON:
{
  "ideas": [
    {
      "id": 1,
      "title": "...",
      "angle": "What makes this idea unique",
      "hook": "Opening hook for this idea",
      "visualDirection": "How to shoot/edit this",
      "onScreenText": ["Text overlay 1", "Text overlay 2"],
      "cta": "...",
      "duration": "0:30",
      "format": "Reel"
    }
  ]
}`

    case 'angles':
      return `${base}

Generate exactly ${input.count ?? 5} unique campaign angles for this brand.

Respond with valid JSON:
{
  "angles": [
    {
      "name": "Angle Name",
      "angle": "Core message and positioning",
      "why": "Why this angle works for this brand",
      "contentFormats": ["Reel", "Story", "Carousel"]
    }
  ]
}`

    case 'calendar':
      return `${base}

Create a 30-day content calendar for this brand. Generate exactly ${input.count ?? 12} calendar entries.

Respond with valid JSON:
{
  "calendar": [
    {
      "date": "Day 1",
      "platform": "instagram",
      "contentType": "Reel|Story|Carousel",
      "title": "...",
      "caption": "...",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}`

    default:
      return base
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'AI service not configured. Set OPENAI_API_KEY in Vercel environment variables.' })
  }

  const input = req.body as GenerationInput

  if (!input.companyName || !input.industry || !input.toolType) {
    return res.status(400).json({ error: 'Missing required fields: companyName, industry, toolType' })
  }

  try {
    const prompt = buildPrompt(input)

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert creative strategist for social media marketing agencies. Always respond with valid, parseable JSON only. No markdown, no explanations outside the JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiRes.ok) {
      const errorBody = await openaiRes.text()
      console.error('[AI] OpenAI error:', errorBody)
      return res.status(502).json({ error: `OpenAI API error: ${openaiRes.status}` })
    }

    const openaiData = await openaiRes.json() as {
      choices: Array<{ message: { content: string } }>
      model: string
      usage: { total_tokens: number }
    }

    const content = openaiData.choices[0]?.message?.content
    if (!content) {
      return res.status(502).json({ error: 'No content returned from OpenAI' })
    }

    const parsed = JSON.parse(content)

    return res.status(200).json({
      ...parsed,
      model: openaiData.model,
      tokensUsed: openaiData.usage?.total_tokens,
    })
  } catch (err) {
    console.error('[AI] Generation error:', err)
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    })
  }
}
