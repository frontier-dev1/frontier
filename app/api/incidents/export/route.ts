import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatIncidentDate(row: any): string {
  // Check occurred_at first, then fallback to other date fields in the database
  const rawDate =
    row.occurred_at ||
    row.published_at ||
    row.incident_date ||
    row.article_date ||
    row.date ||
    row.created_at;

  if (!rawDate) return "N/A";

  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime())
    ? "N/A"
    : parsed.toISOString().split("T")[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "csv";
  const company = searchParams.get("company");
  const model = searchParams.get("model");
  const severity = searchParams.get("severity");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const supabase = await createClient();
  let query = supabase.from("incidents").select("*");

  if (company) {
    query = query.ilike("company", `%${company}%`);
  }

  if (severity) {
    query = query.eq("severity", severity);
  }

  const { data: rawIncidents, error } = await query;

  if (error || !rawIncidents) {
    console.error("Supabase export query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch incidents", details: error?.message },
      { status: 500 }
    );
  }

  // Normalize data using the standardized date logic
  let incidents = rawIncidents.map((i) => ({
    id: i.id || "",
    title: i.title || "Untitled Incident",
    company: i.company || "N/A",
    model: i.ai_model || i.model || "N/A",
    severity: i.severity || "N/A",
    incidentDate: formatIncidentDate(i),
    description: i.description || i.summary || "",
    rawTimestamp: new Date(
      i.occurred_at || i.published_at || i.incident_date || i.date || i.created_at || 0
    ).getTime(),
  }));

  // Preserve descending sort (newest to oldest) in exported output
  incidents.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

  if (model) {
    const searchModel = model.toLowerCase();
    incidents = incidents.filter(
      (inc) =>
        inc.model.toLowerCase().includes(searchModel) ||
        inc.title.toLowerCase().includes(searchModel)
    );
  }

  if (startDate) {
    incidents = incidents.filter(
      (inc) => inc.incidentDate !== "N/A" && inc.incidentDate >= startDate
    );
  }

  if (endDate) {
    incidents = incidents.filter(
      (inc) => inc.incidentDate !== "N/A" && inc.incidentDate <= endDate
    );
  }

  // Handle CSV Export
  if (format === "csv") {
    const headers = ["ID", "Title", "Company", "AI Model", "Severity", "Occurred/Published Date", "Summary"];
    const csvRows = [
      headers.join(","),
      ...incidents.map((row) =>
        [
          `"${row.id}"`,
          `"${row.title.replace(/"/g, '""')}"`,
          `"${row.company.replace(/"/g, '""')}"`,
          `"${row.model.replace(/"/g, '""')}"`,
          `"${row.severity}"`,
          `"${row.incidentDate}"`,
          `"${row.description.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    return new NextResponse(csvRows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ai-rogue-incidents-${Date.now()}.csv"`,
      },
    });
  }

  // Handle PDF Export
  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("Rogue AI Incidents Database Report", 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated on: ${new Date().toLocaleDateString()} | Total Exported Incidents: ${incidents.length}`,
      14,
      21
    );

    const tableHeaders = [["Date", "Title", "Company", "AI Model", "Severity"]];
    const tableData = incidents.map((inc) => [
      inc.incidentDate,
      inc.title,
      inc.company,
      inc.model,
      inc.severity,
    ]);

    autoTable(doc, {
      startY: 26,
      head: tableHeaders,
      body: tableData,
      theme: "striped",
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 30 },  // Date (YYYY-MM-DD)
        1: { cellWidth: 140 }, // Title
        2: { cellWidth: 35 },  // Company
        3: { cellWidth: 35 },  // Model
        4: { cellWidth: 25 },  // Severity
      },
      didDrawPage: () => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${pageCount}`,
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 10
        );
      },
    });

    const pdfBuffer = doc.output("arraybuffer");

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ai-rogue-incidents-${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format requested" }, { status: 400 });
}