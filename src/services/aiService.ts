/**
 * CL — AI Service
 *
 * Calls the Vercel serverless function at /api/ai/generate.
 * Falls back gracefully when AI is not configured.
 *
 * The API key is NEVER exposed in the frontend.
 * It lives in OPENAI_API_KEY (server-side Vercel env var).
 */

import { APP_CONFIG } from '../config/app'
import { supabase, isSupabaseReady } from '../lib/supabase'

export interface AIGenerationInput {
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

export interface AIGenerationOutput {
  hooks?: Array<{ text: string; type: string; explanation: string }>
  scripts?: Array<{ title: string; hook: string; scenes: unknown[]; cta: string; caption: string; hashtags: string[] }>
  captions?: Array<{ main: string; short: string; hashtags: string[] }>
  ideas?: Array<{ id: number; title: string; angle: string; hook: string; visualDirection: string; onScreenText: string[]; cta: string; duration: string; format: string }>
  angles?: Array<{ name: string; angle: string; why: string; contentFormats: string[] }>
  calendar?: Array<{ date: string; platform: string; contentType: string; title: string; caption: string; hashtags: string[] }>
  model?: string
  tokensUsed?: number
}

export const aiService = {
  generate: async (input: AIGenerationInput): Promise<AIGenerationOutput> => {
    if (!APP_CONFIG.features.aiEnabled) {
      throw new Error(
        'AI is not enabled. Set VITE_ENABLE_AI=true and configure OPENAI_API_KEY in your Vercel environment.'
      )
    }

    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI generation failed: ${errorText}`)
    }

    const result: AIGenerationOutput = await response.json()

    // Save to Supabase if configured
    if (isSupabaseReady && supabase && input.clientId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('agency_id')
            .eq('id', user.id)
            .single()

          if (profile) {
            await supabase.from('ai_generations').insert({
              agency_id: (profile as { agency_id: string }).agency_id,
              client_id: input.clientId,
              created_by: user.id,
              tool_type: input.toolType,
              input: input as unknown as Record<string, unknown>,
              output: result as unknown as Record<string, unknown>,
              model: result.model ?? 'gpt-4o',
              tokens_used: result.tokensUsed,
            })
          }
        }
      } catch (err) {
        // Non-critical: log but don't fail the generation
        console.warn('[aiService] Failed to save generation to Supabase:', err)
      }
    }

    return result
  },
}
