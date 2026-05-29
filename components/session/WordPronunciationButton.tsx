"use client";

import { useCallback, useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang.startsWith("en-CA")) ??
    voices.find((voice) => voice.lang.startsWith("en-GB")) ??
    voices.find((voice) => voice.lang.startsWith("en-US")) ??
    voices.find((voice) => voice.lang.startsWith("en"))
  );
}

export function speakWord(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-CA";
  utterance.rate = 0.92;

  const voices = window.speechSynthesis.getVoices();
  const voice = pickEnglishVoice(voices);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

interface WordPronunciationButtonProps {
  word: string;
  className?: string;
  size?: "sm" | "default";
}

export function WordPronunciationButton({
  word,
  className,
  size = "sm",
}: WordPronunciationButtonProps) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    setSupported(true);

    const primeVoices = () => {
      window.speechSynthesis.getVoices();
    };

    primeVoices();
    window.speechSynthesis.addEventListener("voiceschanged", primeVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", primeVoices);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (!supported) return;

    setSpeaking(true);
    speakWord(word);

    window.setTimeout(() => setSpeaking(false), 1200);
  }, [supported, word]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      onClick={handleClick}
      aria-label={`Listen to pronunciation of ${word}`}
      className={cn(className)}
    >
      <Volume2 className={cn("h-4 w-4", speaking && "text-teal-600")} />
      {size !== "sm" && <span className="ml-1.5">Listen</span>}
    </Button>
  );
}
