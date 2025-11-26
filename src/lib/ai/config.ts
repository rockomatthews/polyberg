const resolvedKey =
  process.env.AI_SDK_API_KEY ?? process.env.VERCEL_AI_API_KEY ?? process.env.OPENAI_API_KEY ?? '';

if (!process.env.AI_SDK_API_KEY && resolvedKey) {
  process.env.AI_SDK_API_KEY = resolvedKey;
}

export const aiApiKey = resolvedKey;

export function hasAiAccess() {
  return Boolean(aiApiKey);
}


