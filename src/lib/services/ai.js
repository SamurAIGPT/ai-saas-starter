import { prisma } from "../prisma";
import { UserService } from "./user";
import config from "../config";
import { buildMuapiUrl, buildMuapiWebhookUrl, resolveMuapiEndpoint, validateCreditCost } from "../security.mjs";
import { settleCreation } from "./creation-status";

export const AIService = {
  /**
   * Submit a prediction job to MuAPI, deduct credits, and execute inline polling.
   */
  async generate(userId, { prompt, inputImage, aspectRatio, modelEndpoint = "predictions", appId = null, creditCost = null, model = null, customParams = {} }) {
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20_000) {
      throw new Error("Prompt must be a non-empty string under 20000 characters");
    }
    const cost = validateCreditCost(creditCost !== null ? creditCost : config.ai.generationCost);
    const { isLlm } = resolveMuapiEndpoint({
      endpoint: modelEndpoint,
      model: model || (modelEndpoint === "chat/completions" ? "google/gemini-2.5-flash" : "nano-banana-2"),
      inputImage: Boolean(inputImage),
    });
    const apiKey = config.ai.apiKey;
    const webhookUrl = apiKey ? buildMuapiWebhookUrl(config.auth.webhook_url, config.ai.webhookSecret) : null;
    const targetUrl = apiKey ? buildMuapiUrl({
      endpoint: modelEndpoint,
      model: model || (modelEndpoint === "chat/completions" ? "google/gemini-2.5-flash" : "nano-banana-2"),
      inputImage: Boolean(inputImage),
      webhookUrl,
    }) : null;

    await UserService.deductCredits(userId, cost);

    if (!apiKey) {
      if (process.env.NODE_ENV === "production") {
        await UserService.addCredits(userId, cost);
        throw new Error("AI provider is not configured");
      }
      // Return local mock generation in development if API key is missing
      console.warn("MUAPIAPP_API_KEY is not configured. Running offline simulation.");
      const mockRequestId = `mock_${Math.random().toString(36).substring(2, 9)}`;
      
      const creation = await prisma.creation.create({
        data: {
          userId,
          prompt,
          inputImage,
          requestId: mockRequestId,
          status: "completed",
          resultImage: inputImage || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
          creditCost: cost,
          aspectRatio,
          appId,
        }
      });
      return { id: creation.id, resultImage: creation.resultImage, status: "completed" };
    }

    // 2. Submit to the fixed MUAPI origin; model and endpoint are allow-listed above.
    let bodyPayload = {};
    if (isLlm) {
      let finalPrompt = prompt;
      let systemPromptText = "You are a helpful AI assistant.";
      try {
        const parsed = JSON.parse(prompt);
        if (parsed.chatHistory) {
          finalPrompt = parsed.chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\nAssistant:';
        }
        if (parsed.systemPrompt) {
          systemPromptText = parsed.systemPrompt;
        }
      } catch (e) {
        // Fallback to raw prompt string
      }

      bodyPayload = {
        prompt: finalPrompt,
        system_prompt: systemPromptText,
        model: model || "google/gemini-2.5-flash",
        temperature: 0.7,
        ...customParams,
      };
    } else {
      bodyPayload = {
        prompt,
        images_list: inputImage ? [inputImage] : [],
        aspect_ratio: aspectRatio || "1:1",
        ...customParams,
        webhook: webhookUrl,
      };
    }

    let response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });
    } catch (error) {
      await UserService.addCredits(userId, cost);
      throw error;
    }

    if (!response.ok) {
      // Refund credits on submission error
      await UserService.addCredits(userId, cost);
      const errorText = await response.text();
      throw new Error(`API submission failed: ${response.status} ${errorText}`);
    }

    const responseJson = await response.json();
    const requestId = responseJson.request_id || responseJson.id;
    if (!requestId) {
      await UserService.addCredits(userId, cost);
      throw new Error("No request_id returned from MUAPI");
    }

    // 3. Save initial record to database
    let creation = await prisma.creation.create({
      data: {
        userId,
        prompt,
        inputImage,
        requestId,
        status: "processing",
        creditCost: cost,
        aspectRatio,
        appId,
      }
    });

    // 4. Inline Polling Loop (up to 15 seconds)
    let resultImage = "";
    let status = "processing";
    let completed = false;
    let attempts = 0;

    while (!completed && attempts < 6) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      attempts++;

      try {
        const pollResponse = await fetch(`https://api.muapi.ai/api/v1/predictions/${requestId}/result`, {
          headers: { "x-api-key": apiKey },
        });

        if (pollResponse.ok) {
          const pollJson = await pollResponse.json();
          const checkStatus = pollJson.status || pollJson.state;

          if (checkStatus === "completed" || checkStatus === "succeeded") {
            const outputs = pollJson.outputs || [];
            resultImage = outputs[0] || pollJson.output;
            status = "completed";
            completed = true;
          } else if (checkStatus === "failed") {
            status = "failed";
            completed = true;
          }
        }
      } catch (pollErr) {
        console.error("Error polling prediction:", pollErr);
      }
    }

    // 5. Update creation record in database
    if (completed) {
      creation = await settleCreation(creation.id, {
        status,
        resultImage,
        error: "Polling returned failed status",
      });
    }

    return { id: creation.id, resultImage: creation.resultImage, status: creation.status };
  },

  /**
   * Sync and heal status of a creation record using MuAPI state lookup.
   */
  async syncStatus(creationId) {
    const creation = await prisma.creation.findUnique({
      where: { id: creationId },
      include: { app: true }
    });
    if (!creation || creation.status !== "processing") return creation;

    const apiKey = config.ai.apiKey;
    if (!apiKey) return creation;

    try {
      const response = await fetch(`https://api.muapi.ai/api/v1/predictions/${creation.requestId}/result`, {
        headers: { "x-api-key": apiKey },
      });

      if (response.ok) {
        const result = await response.json();
        const checkStatus = result.status || result.state;

        if (checkStatus === "completed" || checkStatus === "succeeded") {
          const outputs = result.outputs || [];
          const outputUrl = outputs[0] || result.output;
          return await settleCreation(creationId, { status: "completed", resultImage: outputUrl, include: { app: true } });
        } else if (checkStatus === "failed") {
          return await settleCreation(creationId, { status: "failed", error: result.error || "Generation failed", include: { app: true } });
        }
      }
    } catch (e) {
      console.error(`Error syncing creation state ${creationId}:`, e);
    }

    return creation;
  }
};
