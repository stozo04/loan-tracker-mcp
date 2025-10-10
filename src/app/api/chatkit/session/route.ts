import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const CHATKIT_API_URL = "https://api.openai.com/v1/chatkit/sessions";
const CHATKIT_BETA_HEADER = "chatkit_beta=v1";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.OPENAI_CHATKIT_WORKFLOW_ID;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  if (!workflowId) {
    return NextResponse.json(
      { error: "Missing OPENAI_CHATKIT_WORKFLOW_ID environment variable." },
      { status: 500 }
    );
  }

  let body: { deviceId?: string; user?: string } = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    // Ignore JSON parsing errors and fall back to defaults
  }

  const userId = (body.deviceId || body.user || "").trim() || randomUUID();

  try {
    const response = await fetch(CHATKIT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": CHATKIT_BETA_HEADER,
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: userId,
      }),
    });

    if (!response.ok) {
      // Try to parse the error body from OpenAI for better debugging
      const text = await response.text().catch(() => "");
      let parsed: unknown = undefined;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = text;
      }

      // Log the full response for dev debugging
      console.error('[chatkit/session] OpenAI responded with non-OK status', {
        status: response.status,
        statusText: response.statusText,
        body: parsed,
      });

      // Narrow parsed to an object with optional 'error' field
      const parsedObj = typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined;
      const message =
        typeof parsedObj?.error === "string"
          ? (parsedObj.error as string)
          : (typeof parsedObj?.error === 'object' && parsedObj?.error !== null && (parsedObj.error as Record<string, unknown>).message)
          || response.statusText
          || 'Unable to create ChatKit session.';

      return NextResponse.json({ error: message }, { status: response.status });
    }

    const session = await response.json();

    // Log success (useful in dev) with limited data
    console.debug('[chatkit/session] Created ChatKit session', {
      has_client_secret: Boolean(session?.client_secret),
      session_id: session?.id,
    });

    if (!session?.client_secret) {
      return NextResponse.json(
        { error: "ChatKit session did not include a client_secret." },
        { status: 500 }
      );
    }

    return NextResponse.json({ client_secret: session.client_secret });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error creating ChatKit session.";
    console.error("[chatkit/session] Failed to create session", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
