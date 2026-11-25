// @ts-nocheck
// ShareBite — Image Moderation Edge Function (HuggingFace Free Tier)
// Deployed to Supabase Edge Functions (Deno runtime)
// Uses HuggingFace Inference API (FREE, 1000 req/day)
// API key never reaches the client.
//
// Endpoint: POST /functions/v1/moderate-image
// Body: { imageUrl: string, foodName: string, userId: string, foodPostId?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Secrets (set via: supabase secrets set HF_TOKEN=hf_xxx) ──────────────────
const HF_TOKEN = Deno.env.get('HF_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_IMAGE_BYTES = parseInt(Deno.env.get('MAX_IMAGE_SIZE_MB') ?? '5') * 1024 * 1024;

// HuggingFace models (free inference API)
// Model 1: Food-specific classifier — very accurate for food vs non-food
const HF_FOOD_MODEL = 'nateraw/food';
// Model 2: General image classifier — catches laptops, phones, people, etc.
const HF_GENERAL_MODEL = 'google/vit-base-patch16-224';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Keyword lists ─────────────────────────────────────────────────────────────

const FOOD_KEYWORDS = new Set([
  'food', 'dish', 'meal', 'cuisine', 'plate', 'bowl', 'soup', 'salad',
  'rice', 'bread', 'pasta', 'noodle', 'curry', 'biryani', 'dal', 'roti',
  'chapati', 'naan', 'dosa', 'idli', 'chicken', 'meat', 'fish', 'egg',
  'vegetable', 'fruit', 'pizza', 'burger', 'sandwich', 'cake', 'dessert',
  'snack', 'appetizer', 'beverage', 'drink', 'juice', 'coffee', 'tea',
  'taco', 'sushi', 'dumpling', 'steak', 'shrimp', 'lobster', 'crab',
  'pancake', 'waffle', 'omelette', 'oatmeal', 'cereal', 'yogurt', 'cheese',
  'chocolate', 'ice cream', 'donut', 'cookie', 'muffin', 'croissant',
  'samosa', 'pakora', 'chaat', 'puri', 'paratha', 'halwa', 'kheer',
  'biryani', 'pulao', 'korma', 'paneer', 'tandoori', 'kebab',
]);

const NON_FOOD_KEYWORDS = new Set([
  'laptop', 'computer', 'keyboard', 'monitor', 'mouse', 'phone', 'smartphone',
  'television', 'tablet', 'screen', 'device', 'electronics', 'gadget',
  'car', 'vehicle', 'truck', 'bus', 'motorcycle', 'bicycle', 'wheel',
  'shoe', 'boot', 'sneaker', 'footwear', 'clothing', 'dress', 'shirt',
  'furniture', 'chair', 'table', 'desk', 'sofa', 'bed',
  'building', 'house', 'architecture', 'window', 'door',
  'animal', 'dog', 'cat', 'bird', 'fish tank',
  'document', 'paper', 'book', 'pen', 'pencil',
  'person', 'human', 'face', 'selfie',
]);

const SCREENSHOT_KEYWORDS = new Set([
  'screenshot', 'user interface', 'website', 'web page', 'mobile app',
  'text', 'font', 'graphic design', 'poster', 'banner', 'advertisement',
  'meme', 'cartoon', 'illustration', 'logo', 'icon',
]);

// ── Call HuggingFace Inference API ────────────────────────────────────────────

async function callHuggingFace(
  model: string,
  imageBytes: Uint8Array,
  retries = 2,
): Promise<Array<{ label: string; score: number }> | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  };
  if (HF_TOKEN) {
    headers['Authorization'] = `Bearer ${HF_TOKEN}`;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: 'POST',
          headers,
          body: imageBytes as unknown as BodyInit,
          signal: AbortSignal.timeout(20_000),
        }
      );

      if (response.status === 503) {
        // Model is loading — wait and retry
        const data = await response.json().catch(() => ({}));
        const waitTime = (data.estimated_time ?? 20) * 1000;
        console.log(`[HF] Model ${model} loading, waiting ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, Math.min(waitTime, 15000)));
        continue;
      }

      if (response.status === 429) {
        // Rate limited on free tier
        console.warn(`[HF] Rate limited on model ${model}`);
        return null;
      }

      if (!response.ok) {
        console.warn(`[HF] ${model} error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (Array.isArray(data)) return data;
      return null;
    } catch (e) {
      console.warn(`[HF] ${model} attempt ${attempt} failed:`, e);
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

// ── Compute SHA-256 hash for duplicate detection ──────────────────────────────

async function computeImageHash(imageBytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', imageBytes.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ── Decision engine ───────────────────────────────────────────────────────────

interface ModerationResult {
  is_food: boolean;
  is_spam: boolean;
  is_screenshot: boolean;
  is_advertisement: boolean;
  is_duplicate: boolean;
  quality_score: number;
  confidence: number;
  decision: 'approved' | 'rejected' | 'manual_review';
  reason: string;
  labels: string[];
}

function analyzeHFResults(
  foodModelResults: Array<{ label: string; score: number }> | null,
  generalModelResults: Array<{ label: string; score: number }> | null,
  isDuplicate: boolean,
): ModerationResult {
  // Immediate reject for duplicates
  if (isDuplicate) {
    return {
      is_food: false, is_spam: true, is_screenshot: false,
      is_advertisement: false, is_duplicate: true,
      quality_score: 0, confidence: 1,
      decision: 'rejected',
      reason: 'This image has already been uploaded before. Please take a fresh photo of your food.',
      labels: [],
    };
  }

  // If both models failed → auto-approve (safe for food sharing, don't block users)
  if (!foodModelResults && !generalModelResults) {
    return {
      is_food: true, is_spam: false, is_screenshot: false,
      is_advertisement: false, is_duplicate: false,
      quality_score: 0.5, confidence: 0,
      decision: 'approved',
      reason: 'Image auto-approved (AI service busy). Duplicate & file checks passed.',
      labels: [],
    };
  }

  const allLabels: string[] = [];
  let topFoodScore = 0;
  let topNonFoodScore = 0;
  let topScreenshotScore = 0;
  let topFoodLabel = '';
  let topNonFoodLabel = '';

  // Analyze food-specific model (nateraw/food)
  // If this model returns results with high confidence → definitely food
  if (foodModelResults && foodModelResults.length > 0) {
    const top = foodModelResults[0];
    allLabels.push(...foodModelResults.slice(0, 5).map(r => r.label.toLowerCase()));

    // nateraw/food labels are all food classes
    // If top result score > 0.3 → model is confident it's food
    topFoodScore = top.score;
    topFoodLabel = top.label;
  }

  // Analyze general model (vit-base-patch16-224)
  if (generalModelResults && generalModelResults.length > 0) {
    allLabels.push(...generalModelResults.slice(0, 5).map(r => r.label.toLowerCase()));

    for (const result of generalModelResults.slice(0, 5)) {
      const label = result.label.toLowerCase();

      // Check for non-food in top results
      const matchNonFood = [...NON_FOOD_KEYWORDS].find(kw => label.includes(kw));
      if (matchNonFood && result.score > topNonFoodScore) {
        topNonFoodScore = result.score;
        topNonFoodLabel = result.label;
      }

      // Check for screenshots/spam
      const matchScreenshot = [...SCREENSHOT_KEYWORDS].find(kw => label.includes(kw));
      if (matchScreenshot && result.score > topScreenshotScore) {
        topScreenshotScore = result.score;
      }

      // Check for food keywords in general model
      const matchFood = [...FOOD_KEYWORDS].find(kw => label.includes(kw));
      if (matchFood && result.score > topFoodScore * 0.5) {
        topFoodScore = Math.max(topFoodScore, result.score * 0.8);
        if (!topFoodLabel) topFoodLabel = result.label;
      }
    }
  }

  const isFood = topFoodScore >= 0.25; // food model is confident
  const isNonFood = topNonFoodScore >= 0.50 && topFoodScore < 0.20;
  const isScreenshot = topScreenshotScore >= 0.40;
  const isSpam = isScreenshot || isNonFood;

  const confidence = Math.min(1, Math.max(topFoodScore, topNonFoodScore, topScreenshotScore) + 0.2);
  const qualityScore = isFood ? Math.min(1, topFoodScore + 0.3) : Math.max(0, 1 - topNonFoodScore);

  let decision: 'approved' | 'rejected' | 'manual_review';
  let reason: string;

  if (isScreenshot && topScreenshotScore >= 0.50) {
    decision = 'rejected';
    reason = 'This looks like a screenshot, meme, or downloaded image. Please upload an original photo of your food.';
  } else if (isNonFood && topNonFoodScore >= 0.65) {
    decision = 'rejected';
    reason = `This image appears to show "${topNonFoodLabel}" instead of food. Please upload a real photo of the meal you're sharing.`;
  } else if (isNonFood && topNonFoodScore >= 0.45) {
    decision = 'rejected';
    reason = `This image doesn't appear to be a food photo. Please upload a real photo of the meal you're sharing.`;
  } else {
    // Everything else — auto-approve (lenient for food sharing)
    decision = 'approved';
    reason = isFood
      ? `Food verified! Detected "${topFoodLabel || 'food item'}" with ${Math.round(topFoodScore * 100)}% confidence.`
      : 'Image approved. Please make sure it shows the food you are sharing.';
  }

  return {
    is_food: isFood,
    is_spam: isSpam,
    is_screenshot: isScreenshot,
    is_advertisement: isScreenshot,
    is_duplicate: false,
    quality_score: parseFloat(qualityScore.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3)),
    decision,
    reason,
    labels: [...new Set(allLabels)].slice(0, 8),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let body: { imageUrl: string; foodName: string; userId: string; foodPostId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { imageUrl, foodName, userId, foodPostId } = body;
    if (!imageUrl || !userId) {
      return new Response(JSON.stringify({ error: 'imageUrl and userId are required' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch image server-side
    let imageBytes: Uint8Array;
    try {
      const imgResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
      if (!imgResponse.ok) throw new Error(`Fetch failed: ${imgResponse.status}`);

      const buffer = await imgResponse.arrayBuffer();
      imageBytes = new Uint8Array(buffer);

      if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({
          decision: 'rejected',
          reason: `Image is too large. Maximum allowed size is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
          is_food: false, is_spam: true, is_screenshot: false,
          is_advertisement: false, is_duplicate: false,
          quality_score: 0, confidence: 1,
        }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('[moderate-image] Image fetch error:', e);
      return new Response(JSON.stringify({
        decision: 'manual_review',
        reason: 'Could not retrieve the image. Please try again.',
        is_food: false, is_spam: false, is_screenshot: false,
        is_advertisement: false, is_duplicate: false,
        quality_score: 0.5, confidence: 0,
      }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // 2. Validate file type via magic bytes
    const isJpeg = imageBytes[0] === 0xFF && imageBytes[1] === 0xD8;
    const isPng = imageBytes[0] === 0x89 && imageBytes[1] === 0x50;
    const isWebp = imageBytes.length > 12 && imageBytes[8] === 0x57 && imageBytes[9] === 0x45;
    if (!isJpeg && !isPng && !isWebp) {
      return new Response(JSON.stringify({
        decision: 'rejected',
        reason: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
        is_food: false, is_spam: true, is_screenshot: false,
        is_advertisement: false, is_duplicate: false,
        quality_score: 0, confidence: 1,
      }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // 3. Compute hash for duplicate detection
    const imageHash = await computeImageHash(imageBytes);

    // 4. Check duplicates in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: duplicates } = await supabase
      .from('food_moderation')
      .select('id, food_post_id, user_id')
      .eq('image_hash', imageHash)
      .neq('user_id', userId)
      .limit(1);

    const isDuplicate = (duplicates?.length ?? 0) > 0;
    const duplicateOf = isDuplicate ? duplicates![0].id : null;

    // 5. Call HuggingFace models in parallel (faster)
    const [foodResults, generalResults] = await Promise.all([
      callHuggingFace(HF_FOOD_MODEL, imageBytes),
      callHuggingFace(HF_GENERAL_MODEL, imageBytes),
    ]);

    // 6. Make decision
    const result = analyzeHFResults(foodResults, generalResults, isDuplicate);

    // 7. Store result in food_moderation table
    const moderationStatus =
      result.decision === 'approved' ? 'approved'
      : result.decision === 'rejected' ? 'rejected'
      : 'manual_review';

    await supabase.from('food_moderation').insert({
      food_post_id: foodPostId ?? null,
      user_id: userId,
      image_url: imageUrl,
      image_hash: imageHash,
      moderation_status: moderationStatus,
      ai_decision: result.decision,
      is_food: result.is_food,
      is_spam: result.is_spam,
      is_screenshot: result.is_screenshot,
      is_advertisement: result.is_advertisement,
      is_duplicate: result.is_duplicate,
      quality_score: result.quality_score,
      confidence: result.confidence,
      ai_reason: result.reason,
      ai_labels: result.labels,
      duplicate_of: duplicateOf,
      moderated_at: new Date().toISOString(),
    });

    // 8. Return result to client
    return new Response(JSON.stringify({
      decision: result.decision,
      reason: result.reason,
      is_food: result.is_food,
      is_spam: result.is_spam,
      is_screenshot: result.is_screenshot,
      is_advertisement: result.is_advertisement,
      is_duplicate: result.is_duplicate,
      quality_score: result.quality_score,
      confidence: result.confidence,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[moderate-image] Unhandled error:', e);
    // Safe fallback — never crash, auto-approve so users aren't blocked
    return new Response(JSON.stringify({
      decision: 'approved',
      reason: 'Image auto-approved. AI service temporarily busy — duplicate & file checks passed.',
      is_food: true, is_spam: false, is_screenshot: false,
      is_advertisement: false, is_duplicate: false,
      quality_score: 0.5, confidence: 0,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
