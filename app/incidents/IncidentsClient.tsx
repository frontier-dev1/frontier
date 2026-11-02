"use client";

import React, { useState, useMemo, ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import IncidentCard from "@/app/components/IncidentCard";
import { Search, FileSpreadsheet, FileText } from "lucide-react";

interface IncidentsClientProps {
  initialIncidents: any[];
}

function getTimestamp(item: any): number {
  const rawDate =
    item.occurred_at ||
    item.published_at ||
    item.incident_date ||
    item.date ||
    item.created_at;

  if (!rawDate) return 0;
  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function IncidentsClient({ initialIncidents }: IncidentsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sort initial records from newest to oldest by occurred_at
  const incidents = useMemo(() => {
    return [...initialIncidents].sort(
      (a, b) => getTimestamp(b) - getTimestamp(a)
    );
  }, [initialIncidents]);

  const companies = useMemo(() => {
    const list = incidents
      .map((i) => i.company)
      .filter((c): c is string => Boolean(c) && c !== "Unknown");
    return Array.from(new Set(list));
  }, [incidents]);

  const models = useMemo(() => {
    const list = incidents
      .map((i) => i.ai_model || i.model)
      .filter((m): m is string => Boolean(m) && m !== "Unspecified");
    return Array.from(new Set(list));
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const searchContent = `${incident.title || ""} ${incident.summary || ""} ${incident.description || ""}`.toLowerCase();
      const incModel = incident.ai_model || incident.model || "";

      const matchesSearch = !searchTerm || searchContent.includes(searchTerm.toLowerCase());
      const matchesCompany = !selectedCompany || incident.company === selectedCompany;
      const matchesModel = !selectedModel || incModel === selectedModel;
      const matchesSeverity = !selectedSeverity || incident.severity === selectedSeverity;

      const incTime = getTimestamp(incident);
      const matchesStart = !startDate || (incTime > 0 && incTime >= new Date(startDate).getTime());
      const matchesEnd = !endDate || (incTime > 0 && incTime <= new Date(endDate).getTime());

      return (
        matchesSearch &&
        matchesCompany &&
        matchesModel &&
        matchesSeverity &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [
    incidents,
    searchTerm,
    selectedCompany,
    selectedModel,
    selectedSeverity,
    startDate,
    endDate,
  ]);

  const handleExport = (format: "csv" | "pdf") => {
    const params = new URLSearchParams();
    params.append("format", format);

    if (selectedCompany) params.append("company", selectedCompany);
    if (selectedModel) params.append("model", selectedModel);
    if (selectedSeverity) params.append("severity", selectedSeverity);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    window.open(`/api/incidents/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Search and Dataset Export Bar */}
      <div className="p-4 rounded-xl border border-border bg-card text-card-foreground shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search incidents..."
              className="w-full pl-9 pr-4 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Button
              onClick={() => handleExport("csv")}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-border"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Export CSV
            </Button>
            <Button
              onClick={() => handleExport("pdf")}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-border"
            >
              <FileText className="h-4 w-4 text-rose-500" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-border text-sm">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Company
            </label>
            <select
              className="w-full p-2 border border-border rounded bg-background text-foreground text-sm"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              AI Model
            </label>
            <select
              className="w-full p-2 border border-border rounded bg-background text-foreground text-sm"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value="">All Models</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Severity Level
            </label>
            <select
              className="w-full p-2 border border-border rounded bg-background text-foreground text-sm"
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              From Date
            </label>
            <input
              type="date"
              className="w-full p-2 border border-border rounded bg-background text-foreground text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              To Date
            </label>
            <input
              type="date"
              className="w-full p-2 border border-border rounded bg-background text-foreground text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results Counter */}
      <div className="flex justify-between items-center text-sm text-muted-foreground px-1">
        <span>
          Showing {filteredIncidents.length} of {incidents.length} incidents
        </span>
      </div>

      {/* Interactive Incident Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIncidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>

      {filteredIncidents.length === 0 && (
        <div className="text-center py-12 border border-border rounded-xl bg-card text-card-foreground">
          <p className="text-muted-foreground">
            No rogue AI incidents found matching your filter criteria.
          </p>
        </div>
      )}
    </div>
  );
}