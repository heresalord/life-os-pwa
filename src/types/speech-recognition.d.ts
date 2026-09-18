// Ambient types for the Web Speech API's SpeechRecognition interface.
//
// TypeScript's bundled lib.dom.d.ts inconsistently ships SpeechRecognitionEvent
// and SpeechRecognitionErrorEvent but omits the SpeechRecognition interface
// and constructor itself. This file fills in just that gap so
// src/pages/day/DailyLogPage.tsx's voice-to-text feature type-checks,
// without redeclaring the Event types that already exist globally.

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

interface Window {
  SpeechRecognition?: typeof SpeechRecognition
  webkitSpeechRecognition?: typeof SpeechRecognition
}
