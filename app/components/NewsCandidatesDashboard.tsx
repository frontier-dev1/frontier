"use client";

import {
  useMemo,
  useState,
} from "react";
import { Button } from '@/components/ui/button';

import Link from "next/link";

import type { Database } from "../../database.types";

// app/components/NewsCandidatesDashboard.tsx

export function NewsCandidateCard({ candidate }: { candidate: any }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(candidate.status);

  async function handlePublish() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/news-candidates/${candidate.id}/publish`, {
        method: 'POST',
      });
      if (res.ok) setStatus('published');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAIReview() {
    setLoading(true);
    try {
      await fetch(`/api/admin/news-candidates/${candidate.id}/ai-review`, {
        method: 'POST',
      });
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (status === 'published') return null;

  return (
    <div className="border rounded-lg p-4 mb-4 bg-card">
      <h3 className="font-bold text-lg">{candidate.title}</h3>
      <p className="text-sm text-muted-foreground mb-2">{candidate.summary || 'No summary generated yet.'}</p>
      {candidate.ai_score !== undefined && (
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded mr-2">
          AI Relevance Score: {candidate.ai_score}/100
        </span>
      )}
      <div className="flex gap-2 mt-4">
        <Button onClick={handleAIReview} disabled={loading} variant="outline" size="sm">
          Auto AI Review
        </Button>
        <Button onClick={handlePublish} disabled={loading} variant="default" size="sm">
          Click to Publish
        </Button>
      </div>
    </div>
  );
}