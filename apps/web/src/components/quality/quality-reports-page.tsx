"use client";



import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";



import { ModuleDetailPage, ModuleDetailSection } from "@/components/module/module-detail-ui";

import { reportRowHref } from "@/components/quality/quality-routes";

import { Button } from "@/components/ui/button";

import { exportReportCsv, loadQualityReports, type QualityReportSummary } from "@/services/quality-service";



export function QualityReportsPage() {

  const router = useRouter();

  const [reports, setReports] = useState<QualityReportSummary[]>([]);

  const [loading, setLoading] = useState(true);



  const load = useCallback(async () => {

    setLoading(true);

    try {

      setReports(await loadQualityReports());

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    void load();

  }, [load]);



  return (

    <ModuleDetailPage

      title="Quality Reports"

      subtitle="FRD-14 §22 — inspection, NCR, CAPA, and KPI summaries"

      backHref="/quality"

      backLabel="Quality home"

      loading={loading}

      onRefresh={() => void load()}

    >

      <div className="space-y-6">

        {reports.map((report) => (

          <ModuleDetailSection key={report.name} title={report.name.replace(/-/g, " ")}>

            <div className="mb-3 flex items-center justify-between gap-2">

              <p className="text-xs text-muted-foreground">

                {report.row_count} rows

                {report.name !== "kpi-dashboard" ? " · click a row to open detail" : ""}

              </p>

              {report.rows.length > 0 ? (

                <Button type="button" size="sm" variant="outline" onClick={() => exportReportCsv(report)}>

                  Export CSV

                </Button>

              ) : null}

            </div>

            {report.rows.length === 0 ? (

              <p className="text-sm text-muted-foreground">No data for this period.</p>

            ) : (

              <div className="erp-scroll overflow-x-auto">

                <table className="w-full min-w-[480px] text-left text-sm">

                  <thead>

                    <tr className="border-b text-xs text-muted-foreground uppercase">

                      {Object.keys(report.rows[0] ?? {}).slice(0, 6).map((key) => (

                        <th key={key} className="py-2 pr-4 font-medium">

                          {key.replace(/_/g, " ")}

                        </th>

                      ))}

                    </tr>

                  </thead>

                  <tbody>

                    {report.rows.slice(0, 20).map((row, idx) => {

                      const href = reportRowHref(report.name, row);

                      return (

                        <tr

                          key={idx}

                          className={`border-b border-border/50 transition-colors duration-150 last:border-0 ${

                            href ? "cursor-pointer hover:bg-accent/30" : ""

                          }`}

                          onClick={href ? () => router.push(href) : undefined}

                          onKeyDown={

                            href

                              ? (e) => {

                                  if (e.key === "Enter") router.push(href);

                                }

                              : undefined

                          }

                          tabIndex={href ? 0 : undefined}

                          role={href ? "link" : undefined}

                        >

                          {Object.keys(report.rows[0] ?? {})

                            .slice(0, 6)

                            .map((key) => (

                              <td

                                key={key}

                                className={`py-2 pr-4 ${href && key.includes("document") ? "font-medium text-primary" : "text-muted-foreground"}`}

                              >

                                {String(row[key] ?? "—")}

                              </td>

                            ))}

                        </tr>

                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

          </ModuleDetailSection>

        ))}

      </div>

    </ModuleDetailPage>

  );

}

