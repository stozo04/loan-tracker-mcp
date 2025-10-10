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
      const error = await response.json().catch(() => ({}));
      const message =
        typeof error?.error === "string"
          ? error.error
          : error?.error?.message || response.statusText;
      return NextResponse.json(
        { error: message || "Unable to create ChatKit session." },
        { status: response.status }
      );
    }

    const session = await response.json();

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
