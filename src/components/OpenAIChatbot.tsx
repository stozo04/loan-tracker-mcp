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
        // This component expects its parent to position it (the parent uses `fixed bottom-4 right-4`).
        // Inside the parent container we position the trigger and panel.
        <div className="relative w-full h-full" style={{ zIndex: 1050 }}>
            {/* Trigger button (circular) */}
            {!isOpen && (
                <button
                    type="button"
                    className={`absolute bottom-4 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform ${isTriggerHovered ? 'scale-105' : ''}`}
                    onClick={() => {
                        setIsTriggerHovered(false);
                        setIsOpen(true);
                    }}
                    aria-label="Open chat"
                    onMouseEnter={() => setIsTriggerHovered(true)}
                    onMouseLeave={() => setIsTriggerHovered(false)}
                    style={{ backgroundColor: '#2563eb', color: '#fff' }}
                >
                    <BsStars size={22} />
                </button>
            )}

            {/* Chat panel */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 360, height: 520 }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                        <div className="text-base font-semibold text-gray-800">Loan Manager Assistant</div>
                        <button className="text-sm text-gray-600 px-2 py-1 hover:text-gray-800" onClick={() => setIsOpen(false)} aria-label="Close chat">Close</button>
                    </div>
                    <ChatKit
                        ref={chatKitRef}
                        control={control}
                        className="chatkit-widget h-[calc(100%-48px)]"
                        style={{ width: '100%', height: 'calc(100% - 48px)' }}
                    />
                </div>
            )}
        </div>
    );
}
