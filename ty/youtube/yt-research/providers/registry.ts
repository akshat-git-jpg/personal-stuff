import { AIProvider } from "./types";
import { GeminiProvider } from "./gemini";

type ProviderFactory = (model: string) => AIProvider;

const registry: Record<string, ProviderFactory> = {
  gemini: (model: string) => new GeminiProvider(model),
};

export function getProvider(config: { provider: string; model: string }): AIProvider {
  const factory = registry[config.provider];
  if (!factory) {
    throw new Error(
      `Unknown provider "${config.provider}". Available: ${Object.keys(registry).join(", ")}`
    );
  }
  return factory(config.model);
}
