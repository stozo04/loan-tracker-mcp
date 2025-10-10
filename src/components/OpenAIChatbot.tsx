'use client';

import { useMemo, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import type { OpenAIChatKit } from "@openai/chatkit";
import { BsStars } from "react-icons/bs";

const STORAGE_KEY = "chatkit-device-id";

const loadDeviceId = () => {
    if (typeof window === "undefined") {
        return undefined;
    }

    try {
        const existing = window.localStorage.getItem(STORAGE_KEY);
        if (existing) {
            return existing;
        }

        const created = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        window.localStorage.setItem(STORAGE_KEY, created);
        return created;
    } catch {
        return undefined;
    }
};

export default function ChatKitWidget() {
    const deviceId = useMemo(() => loadDeviceId(), []);
    const latestDeviceId = useRef(deviceId);
    const chatKitRef = useRef<OpenAIChatKit | null>(null);
    latestDeviceId.current = deviceId;
    const [isOpen, setIsOpen] = useState(false);
    const [isTriggerHovered, setIsTriggerHovered] = useState(false);

    const { control } = useChatKit({
        theme: {
            colorScheme: "light",
            radius: "pill",
            density: "normal",
            typography: {
                baseSize: 16,
                fontFamily:
                    '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
                fontFamilyMono:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
                fontSources: [
                    {
                        family: "OpenAI Sans",
                        src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
                        weight: 400,
                        style: "normal",
                        display: "swap",
                    },
                    {
                        family: "OpenAI Sans",
                        src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Medium.woff2",
                        weight: 500,
                        style: "normal",
                        display: "swap",
                    },
                    {
                        family: "OpenAI Sans",
                        src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Semibold.woff2",
                        weight: 600,
                        style: "normal",
                        display: "swap",
                    },
                ],
            },
        },
        startScreen: {
            greeting: "Loan Manager Assistant",
            prompts: [
                {
                    icon: "circle-question",
                    label: "What Is Loan Manager",
                    prompt: "Tell me about what this app is used for.",
                },
                {
                    icon: "square-code",
                    label: "Suggested Prompts",
                    prompt: "Show me an example of how to create a loan.",
                },
            ],
        },
        history: {
            enabled: true,
        },
        header: {
            leftAction: {
                icon: "sidebar-open-left",
                onClick: () => {
                    const historyToggle = chatKitRef.current?.shadowRoot?.querySelector(
                        'button[aria-label="History"]',
                    ) as HTMLButtonElement | null;
                    historyToggle?.click();
                },
            },
            rightAction: {
                icon: "close",
                onClick: () => setIsOpen(false),
            },
        },
        composer: {
            placeholder: "Type your message...",
            attachments: {
                enabled: false,
            },
        },
        api: {
            async getClientSecret() {
                const res = await fetch("/api/chatkit/session", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        deviceId: latestDeviceId.current,
                    }),
                });

                if (!res.ok) {
                    const error = await res.json().catch(() => ({}));
                    const message =
                        typeof error?.error === "string"
                            ? error.error
                            : error?.error?.message || "Unable to fetch ChatKit client secret.";
                    throw new Error(message);
                }

                const payload = await res.json();
                if (!payload?.client_secret) {
                    throw new Error("ChatKit session response missing client_secret.");
                }
                return payload.client_secret as string;
            },
        },
    });

    return (
        <div
            className="position-fixed bottom-0 end-0 mb-4 me-4"
            style={{ zIndex: 1050 }}
        >
            <button
                type="button"
                className="btn btn-primary rounded-circle shadow d-flex align-items-center justify-content-center mb-2"
                style={{
                    width: 60,
                    height: 60,
                    backgroundColor: "#fe9a9b",
                    borderColor: "#fe9a9b",
                    display: isOpen ? "none" : "flex",
                    transform: isTriggerHovered ? "translateY(-4px) scale(1.05)" : "translateY(0) scale(1)",
                    boxShadow: isTriggerHovered
                        ? "0 12px 24px rgba(254, 154, 155, 0.45)"
                        : "0 8px 18px rgba(254, 154, 155, 0.35)",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onClick={() => {
                    setIsTriggerHovered(false);
                    setIsOpen(true);
                }}
                aria-label="Open chat"
                onMouseEnter={() => setIsTriggerHovered(true)}
                onMouseLeave={() => setIsTriggerHovered(false)}
            >
                <BsStars size={28} color="#ffffff" />
            </button>
            <div
                style={{
                    width: 360,
                    height: 520,
                    display: isOpen ? "block" : "none",
                    boxShadow: "0 24px 45px rgba(34, 34, 34, 0.22)",
                    borderRadius: 18,
                    transition: "box-shadow 0.25s ease",
                }}
            >
                <ChatKit
                    ref={chatKitRef}
                    control={control}
                    className="chatkit-widget rounded shadow"
                    style={{ width: "100%", height: "100%" }}
                />
            </div>
        </div>
    );
}
