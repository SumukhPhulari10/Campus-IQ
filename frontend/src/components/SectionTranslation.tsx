import React, { useState } from 'react';
import { apiFetch as fetch } from '../lib/api';

interface SectionTranslationProps {
  text: string;
  enabled: boolean;
}

export const SectionTranslation: React.FC<SectionTranslationProps> = ({ text, enabled }) => {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!enabled || !text.trim()) return null;

  const translate = async () => {
    if (translatedText) {
      setTranslatedText(null);
      setError('');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: 'Marathi' }),
      });
      const responseText = await response.text();
      let data: { translatedText?: string; error?: string };
      try {
        data = JSON.parse(responseText) as { translatedText?: string; error?: string };
      } catch {
        throw new Error(
          response.ok
            ? 'The translation service returned an unreadable response. Please try again.'
            : `Translation service failed (HTTP ${response.status}). Please try again.`,
        );
      }

      if (!response.ok) throw new Error(data.error || `Translation failed (HTTP ${response.status}).`);
      if (!data.translatedText?.trim()) throw new Error('The translation was empty. Please try again.');
      setTranslatedText(data.translatedText.trim());
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : 'Translation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          void translate();
        }}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#b0f0d6] bg-white px-3 py-1.5
                   text-[11px] font-bold text-[#003527] transition-colors hover:bg-[#effaf5] disabled:opacity-60"
      >
        <span className={`material-symbols-outlined text-[15px] ${isLoading ? 'animate-spin' : ''}`}>
          {isLoading ? 'progress_activity' : 'translate'}
        </span>
        {isLoading ? 'Translating…' : translatedText ? 'Show English' : 'मराठीत भाषांतर'}
      </button>
      {error && <p role="alert" className="mt-2 text-[11px] text-red-700">{error}</p>}
      {translatedText && (
        <p lang="mr" className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm
                                leading-relaxed text-[#23483d] whitespace-pre-line">
          {translatedText}
        </p>
      )}
    </div>
  );
};
