'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface NewsCandidate {
  id: string;
  title: string;
  url: string;
  summary?: string | null;
  status: string;
  ai_score?: number | null;
  created_at?: string;
}

export default function NewsCandidatesPage() {
  const [candidates, setCandidates] = useState<NewsCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  async function fetchCandidates() {
    try {
      const res = await fetch('/api/admin/news-candidates');
      if (res.ok) {
        const data = await res.json();
        setCandidates(Array.isArray(data) ? data : data.candidates || []);
      }
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/news-candidates/${id}/publish`, { method: 'POST' });
      if (res.ok) {
        setCandidates((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Publish error:', err);
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/news-candidates/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        setCandidates((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error('Reject error:', err);
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading candidates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">AI News Candidates</h1>
        <span className="text-sm text-muted-foreground">{candidates.length} pending items</span>
      </div>

      {candidates.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
          No news candidates pending review.
        </div>
      ) : (
        <div className="grid gap-4">
          {candidates.map((item) => (
            <div key={item.id} className="border rounded-lg p-5 bg-card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-lg hover:underline text-primary"
                  >
                    {item.title || 'Untitled Article'}
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.summary || 'No summary available.'}
                  </p>
                </div>
                {item.ai_score !== undefined && item.ai_score !== null && (
                  <span className="shrink-0 text-xs font-mono bg-accent px-2.5 py-1 rounded-full border">
                    Score: {item.ai_score}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(item.id)}
                  disabled={actionId === item.id}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handlePublish(item.id)}
                  disabled={actionId === item.id}
                >
                  {actionId === item.id ? 'Publishing...' : 'Approve & Publish'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}