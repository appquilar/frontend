import { Lock, Sparkles, Target, Timer, TrendingUp, Users } from "lucide-react";

import type {
    AdvancedStatsValueFormat,
    CompanyAdvancedStatsKpi,
    CompanyAdvancedStatsProductRow,
} from "@/domain/models/CompanyAdvancedStats";
import { useCompanyAdvancedStats } from "@/application/hooks/useCompanyAdvancedStats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvancedStatsDeltaBadge } from "@/components/dashboard/stats/AdvancedStatsDeltaBadge";

interface CompanyAdvancedStatsPremiumProps {
    companyId: string;
    period?: { from?: string; to?: string };
    hasAccess: boolean;
}

interface ProductHighlight {
    key: string;
    label: string;
    description: string;
    productName: string;
    productInternalId: string;
    valueLabel: string;
    secondaryLabel: string;
    delta?: CompanyAdvancedStatsProductRow["deltaVsPrevious"];
}

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const formatValue = (value: number | null, format: AdvancedStatsValueFormat): string => {
    if (value == null) {
        return "N/D";
    }

    if (format === "percentage") {
        return formatPercent(value);
    }

    if (format === "duration_minutes") {
        const rounded = Math.round(value);
        if (rounded >= 60) {
            const hours = Math.floor(rounded / 60);
            const minutes = rounded % 60;
            return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
        }

        return `${rounded} min`;
    }

    return value.toLocaleString("es-ES");
};

const sortProductRows = (
    rows: CompanyAdvancedStatsProductRow[],
    comparator: (left: CompanyAdvancedStatsProductRow, right: CompanyAdvancedStatsProductRow) => number
): CompanyAdvancedStatsProductRow[] => [...rows].sort(comparator);

const buildProductHighlights = (rows: CompanyAdvancedStatsProductRow[]): ProductHighlight[] => {
    const highlights: ProductHighlight[] = [];
    const seenProducts = new Set<string>();

    const uniqueByTraffic = sortProductRows(
        rows,
        (left, right) => right.uniqueVisitors - left.uniqueVisitors
    );
    const uniqueByConversion = sortProductRows(
        rows.filter((row) => row.uniqueVisitors > 0),
        (left, right) => right.uniqueToConversationRate - left.uniqueToConversationRate
    );
    const uniqueByDelta = sortProductRows(
        rows.filter((row) => row.deltaVsPrevious.kind !== "neutral" || row.deltaVsPrevious.absoluteChange !== 0),
        (left, right) => Math.abs(right.deltaVsPrevious.percentageChange) - Math.abs(left.deltaVsPrevious.percentageChange)
    );

    const pushHighlight = (
        key: string,
        label: string,
        description: string,
        valueLabelBuilder: (row: CompanyAdvancedStatsProductRow) => string,
        secondaryLabelBuilder: (row: CompanyAdvancedStatsProductRow) => string,
        candidates: CompanyAdvancedStatsProductRow[],
        includeDelta = false
    ) => {
        const candidate = candidates.find((row) => !seenProducts.has(row.productId));
        if (!candidate) {
            return;
        }

        seenProducts.add(candidate.productId);
        highlights.push({
            key,
            label,
            description,
            productName: candidate.productName,
            productInternalId: candidate.productInternalId,
            valueLabel: valueLabelBuilder(candidate),
            secondaryLabel: secondaryLabelBuilder(candidate),
            delta: includeDelta ? candidate.deltaVsPrevious : undefined,
        });
    };

    pushHighlight(
        "traffic",
        "Más visitas únicas",
        "Producto con mayor alcance dentro del rango actual.",
        (row) => `${row.uniqueVisitors.toLocaleString("es-ES")} únicas`,
        (row) => `${row.totalViews.toLocaleString("es-ES")} visitas totales`,
        uniqueByTraffic
    );
    pushHighlight(
        "conversion",
        "Mejor conversión",
        "Producto que mejor transforma visitas únicas en conversación.",
        (row) => formatPercent(row.uniqueToConversationRate),
        (row) => `${row.messageThreads.toLocaleString("es-ES")} conversaciones`,
        uniqueByConversion
    );
    pushHighlight(
        "delta",
        "Mayor cambio reciente",
        "Movimiento más claro frente al periodo anterior.",
        (row) => formatPercent(row.visitToConversationRate),
        () => "vs periodo anterior",
        uniqueByDelta,
        true
    );

    return highlights;
};

const PremiumTeaser = () => (
    <Card className="border-dashed border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80">
        <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-base text-[#0F172A]">
                        <Sparkles className="h-4 w-4 text-[#F19D70]" />
                        Rendimiento comercial
                    </CardTitle>
                    <CardDescription>
                        Disponible para empresas con acceso a este bloque y administradores.
                    </CardDescription>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    <Lock className="h-3.5 w-3.5" />
                    Acceso adicional
                </div>
            </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-[#0F172A]">Embudo real</p>
                <p className="mt-1 text-sm text-[#0F172A]/60">
                    Detecta dónde se pierde la conversión entre visitas, únicas y conversaciones.
                </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-[#0F172A]">Señales accionables</p>
                <p className="mt-1 text-sm text-[#0F172A]/60">
                    Señales deterministas de tráfico, conversión y productos dormidos.
                </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-[#0F172A]">Comparativa temporal</p>
                <p className="mt-1 text-sm text-[#0F172A]/60">
                    KPIs con delta frente al periodo anterior.
                </p>
            </div>
        </CardContent>
    </Card>
);

const PremiumLoadingState = () => (
    <Card>
        <CardHeader>
            <CardTitle>Rendimiento comercial</CardTitle>
            <CardDescription>Cargando métricas de rendimiento…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 p-4">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="mt-3 h-8 w-24" />
                        <Skeleton className="mt-4 h-4 w-28" />
                    </div>
                ))}
            </div>
            <Skeleton className="h-[220px] w-full rounded-xl" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
        </CardContent>
    </Card>
);

const KpiCard = ({ kpi }: { kpi: CompanyAdvancedStatsKpi }) => (
    <Card className="border-slate-200/80">
        <CardHeader className="space-y-3 pb-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <CardTitle className="text-sm font-medium text-[#0F172A]">{kpi.label}</CardTitle>
                    <CardDescription className="mt-1 text-xs leading-relaxed">
                        {kpi.description}
                    </CardDescription>
                </div>
                <AdvancedStatsDeltaBadge
                    delta={kpi.delta}
                    trendPreference={kpi.trendPreference}
                />
            </div>
        </CardHeader>
        <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-[#0F172A]">
                {formatValue(kpi.currentValue, kpi.format)}
            </p>
            <p className="text-xs text-[#0F172A]/55">
                Periodo anterior: {formatValue(kpi.previousValue, kpi.format)}
            </p>
        </CardContent>
    </Card>
);

export const CompanyAdvancedStatsPremium = ({
    companyId,
    period,
    hasAccess,
}: CompanyAdvancedStatsPremiumProps) => {
    const query = useCompanyAdvancedStats(companyId, period, hasAccess);

    if (!hasAccess) {
        return <PremiumTeaser />;
    }

    if (query.isLoading) {
        return <PremiumLoadingState />;
    }

    if (query.error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Rendimiento comercial</CardTitle>
                    <CardDescription>
                        No se pudieron cargar las métricas de rendimiento con el rango seleccionado.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const data = query.data;
    if (!data) {
        return null;
    }

    const funnelBase = data.funnel.steps[0]?.value ?? 0;
    const responseKpi = data.responsePerformance.averageFirstResponse;
    const visibleConversionKpis = data.conversionKpis.filter(
        (kpi) => kpi.key !== "average_first_response_minutes"
    );
    const productHighlights = buildProductHighlights(data.productConversionRows);
    const visibleInsights = data.insights.filter(
        (insight) => !insight.key.startsWith("backend-opportunity-")
    );
    const unavailableNotes = [
        data.sectionAvailability.trafficSources,
        data.sectionAvailability.lostDemand,
    ].filter((section) => !section.available && section.reason);

    return (
        <div className="space-y-4">
            <Card className="border-slate-200/80 bg-white/95">
                <CardHeader className="gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-base text-[#0F172A]">
                                <Sparkles className="h-4 w-4 text-[#F19D70]" />
                                Rendimiento comercial
                            </CardTitle>
                            <CardDescription>
                                Ratios, embudo y señales derivados de los datos disponibles.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {visibleConversionKpis.map((kpi) => (
                        <KpiCard key={kpi.key} kpi={kpi} />
                    ))}
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-slate-200/80">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Target className="h-4 w-4 text-[#F19D70]" />
                                    Embudo de conversión
                                </CardTitle>
                                <CardDescription>
                                    Se adapta a las etapas disponibles en este momento.
                                </CardDescription>
                            </div>
                            <AdvancedStatsDeltaBadge delta={data.funnel.delta} />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {data.funnel.steps.map((step) => (
                            <div key={step.key} className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <div>
                                        <p className="font-medium text-[#0F172A]">{step.label}</p>
                                        <p className="text-xs text-[#0F172A]/55">
                                            {step.conversionFromPrevious == null
                                                ? "Paso inicial"
                                                : `${formatPercent(step.conversionFromPrevious)} desde la etapa anterior`}
                                        </p>
                                    </div>
                                    <p className="text-lg font-semibold text-[#0F172A]">
                                        {step.value.toLocaleString("es-ES")}
                                    </p>
                                </div>
                                <Progress
                                    value={funnelBase > 0 ? step.shareOfFirstStep * 100 : 0}
                                    className="h-2 bg-slate-100"
                                />
                            </div>
                        ))}
                        <div className="rounded-xl border border-[#F19D70]/20 bg-[#FFF7F2] p-4">
                            <p className="text-sm font-medium text-[#0F172A]">
                                {"Conversión global visita -> conversación"}
                            </p>
                            <div className="mt-2 flex items-center gap-3">
                                <p className="text-2xl font-bold text-[#C86A35]">
                                    {formatPercent(data.funnel.overallConversionRate)}
                                </p>
                                <span className="text-sm text-[#0F172A]/55">
                                    vs anterior {formatPercent(data.funnel.previousOverallConversionRate)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/80">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Timer className="h-4 w-4 text-[#F19D70]" />
                            Rendimiento de atención
                        </CardTitle>
                        <CardDescription>
                            Métricas comerciales disponibles para este periodo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-[#0F172A]">1ª respuesta media</p>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] text-slate-500"
                                                        aria-label="Información sobre la primera respuesta media"
                                                    >
                                                        i
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                                    {data.responsePerformance.helperText}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <p className="text-2xl font-bold text-[#0F172A]">
                                        {formatValue(responseKpi.currentValue, responseKpi.format)}
                                    </p>
                                    <p className="text-xs text-[#0F172A]/55">
                                        Periodo anterior: {formatValue(responseKpi.previousValue, responseKpi.format)}
                                    </p>
                                </div>
                                <AdvancedStatsDeltaBadge
                                    delta={responseKpi.delta}
                                    trendPreference={responseKpi.trendPreference}
                                />
                            </div>
                        </div>

                        {unavailableNotes.length > 0 && (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-[#0F172A]/60">
                                <p className="font-medium text-[#0F172A]">Próximas métricas</p>
                                <ul className="mt-2 space-y-1">
                                    {unavailableNotes.map((section) => (
                                        <li key={section.reason}>{section.reason}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200/80">
                <CardHeader>
                    <CardTitle className="text-base">Lecturas por producto</CardTitle>
                    <CardDescription>
                        Resumen compacto para complementar el desglose detallado del panel base.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                    {productHighlights.length === 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-[#0F172A]/60 md:col-span-3">
                            Sin lecturas destacadas por producto para este rango todavía.
                        </div>
                    )}
                    {productHighlights.map((highlight) => (
                        <div key={highlight.key} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-[#0F172A]">{highlight.label}</p>
                                    <p className="mt-1 text-sm text-[#0F172A]/60">{highlight.description}</p>
                                </div>
                                {highlight.key === "traffic" ? (
                                    <Users className="mt-0.5 h-4 w-4 text-[#F19D70]" />
                                ) : (
                                    <TrendingUp className="mt-0.5 h-4 w-4 text-[#F19D70]" />
                                )}
                            </div>
                            <div className="mt-4 space-y-1">
                                <p className="font-medium text-[#0F172A]">{highlight.productName}</p>
                                <p className="text-xs text-[#0F172A]/45">
                                    ID interno: {highlight.productInternalId || "—"}
                                </p>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-2xl font-bold text-[#0F172A]">{highlight.valueLabel}</p>
                                    <p className="text-xs text-[#0F172A]/55">{highlight.secondaryLabel}</p>
                                </div>
                                {highlight.delta && <AdvancedStatsDeltaBadge delta={highlight.delta} />}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-slate-200/80">
                <CardHeader>
                    <CardTitle className="text-base">Señales automáticas</CardTitle>
                    <CardDescription>
                        Reglas deterministas basadas en métricas reales del periodo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                    {visibleInsights.length === 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-[#0F172A]/60">
                            No hay señales relevantes para este rango todavía.
                        </div>
                    )}
                    {visibleInsights.map((insight) => (
                        <div key={insight.key} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-[#0F172A]">{insight.title}</p>
                                    <p className="mt-1 text-sm text-[#0F172A]/60">{insight.description}</p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={
                                        insight.severity === "success"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : insight.severity === "warning"
                                                ? "bg-amber-100 text-amber-700"
                                                : "bg-slate-100 text-slate-600"
                                    }
                                >
                                    {insight.severity === "success"
                                        ? "Oportunidad"
                                        : insight.severity === "warning"
                                            ? "Atención"
                                            : "Actividad"}
                                </Badge>
                            </div>
                            {insight.metrics.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {insight.metrics.map((metric) => (
                                        <span
                                            key={`${insight.key}-${metric.label}`}
                                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-[#0F172A]/70"
                                        >
                                            {metric.label}: {formatValue(metric.value, metric.format)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};
