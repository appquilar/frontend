import {
    differenceInCalendarDays,
    format,
    parseISO,
    subDays,
} from "date-fns";

import type {
    AdvancedStatsDelta,
    CompanyAdvancedStats,
    CompanyAdvancedStatsFunnel,
    CompanyAdvancedStatsInsight,
    CompanyAdvancedStatsInsightMetric,
    CompanyAdvancedStatsKpi,
    CompanyAdvancedStatsPeriod,
    CompanyAdvancedStatsProductRow,
} from "@/domain/models/CompanyAdvancedStats";
import type {
    CompanyEngagementStats,
    EngagementByProduct,
} from "@/domain/models/CompanyEngagementStats";
import type { Product } from "@/domain/models/Product";
import type { CompanyEngagementRepository } from "@/domain/repositories/CompanyEngagementRepository";
import type { ProductRepository } from "@/domain/repositories/ProductRepository";

const COMPANY_PRODUCTS_PAGE_SIZE = 200;
const MAX_DORMANT_INSIGHTS = 3;

const safeDivide = (numerator: number, denominator: number): number => {
    if (denominator <= 0) {
        return 0;
    }

    return numerator / denominator;
};

const buildDelta = (
    currentValue: number | null | undefined,
    previousValue: number | null | undefined
): AdvancedStatsDelta => {
    const current = currentValue ?? 0;
    const previous = previousValue ?? 0;

    if (current === 0 && previous === 0) {
        return {
            kind: "neutral",
            absoluteChange: 0,
            percentageChange: 0,
        };
    }

    if (previous === 0 && current > 0) {
        return {
            kind: "new",
            absoluteChange: current,
            percentageChange: 0,
        };
    }

    const absoluteChange = current - previous;
    if (absoluteChange === 0) {
        return {
            kind: "neutral",
            absoluteChange: 0,
            percentageChange: 0,
        };
    }

    return {
        kind: absoluteChange > 0 ? "increase" : "decrease",
        absoluteChange,
        percentageChange: safeDivide(absoluteChange, previous) * 100,
    };
};

const buildInsightMetric = (
    label: string,
    value: number,
    format: CompanyAdvancedStatsInsightMetric["format"]
): CompanyAdvancedStatsInsightMetric => ({
    label,
    value,
    format,
});

const percentile = (values: number[], target: number): number => {
    if (values.length === 0) {
        return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const index = (sorted.length - 1) * target;
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    if (lowerIndex === upperIndex) {
        return sorted[lowerIndex];
    }

    const weight = index - lowerIndex;
    return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
};

const resolvePeriod = (period: { from: string; to: string }): CompanyAdvancedStatsPeriod => ({
    from: period.from,
    to: period.to,
});

const buildPreviousPeriod = (
    currentPeriod: CompanyAdvancedStatsPeriod
): CompanyAdvancedStatsPeriod => {
    const from = parseISO(currentPeriod.from);
    const to = parseISO(currentPeriod.to);
    const days = differenceInCalendarDays(to, from) + 1;
    const previousTo = subDays(from, 1);
    const previousFrom = subDays(previousTo, days - 1);

    return {
        from: format(previousFrom, "yyyy-MM-dd"),
        to: format(previousTo, "yyyy-MM-dd"),
    };
};

const buildRateKpi = (
    key: CompanyAdvancedStatsKpi["key"],
    label: string,
    description: string,
    currentValue: number | null,
    previousValue: number | null,
    trendPreference: CompanyAdvancedStatsKpi["trendPreference"]
): CompanyAdvancedStatsKpi => ({
    key,
    label,
    description,
    format: key === "average_first_response_minutes" ? "duration_minutes" : "percentage",
    trendPreference,
    currentValue,
    previousValue,
    delta: buildDelta(currentValue, previousValue),
});

const buildProductRow = (
    currentRow: EngagementByProduct,
    previousRow: EngagementByProduct | null | undefined,
    productsById: Map<string, Product>
): CompanyAdvancedStatsProductRow => {
    const product = productsById.get(currentRow.productId);
    const currentRate = safeDivide(currentRow.messageThreads, currentRow.totalViews);
    const previousRate = previousRow
        ? safeDivide(previousRow.messageThreads, previousRow.totalViews)
        : 0;

    return {
        productId: currentRow.productId,
        productName: currentRow.productName,
        productSlug: currentRow.productSlug || product?.slug || "",
        productInternalId: product?.internalId ?? "",
        totalViews: currentRow.totalViews,
        uniqueVisitors: currentRow.uniqueVisitors,
        messageThreads: currentRow.messageThreads,
        visitToConversationRate: currentRate,
        uniqueToConversationRate: safeDivide(currentRow.messageThreads, currentRow.uniqueVisitors),
        messageToRentalRate: currentRow.messageToRentalRatio,
        deltaVsPrevious: buildDelta(currentRate, previousRate),
    };
};

const buildFunnel = (
    currentStats: CompanyEngagementStats,
    previousStats: CompanyEngagementStats
): CompanyAdvancedStatsFunnel => {
    const firstStepValue = currentStats.summary.totalViews;
    const steps: CompanyAdvancedStatsFunnel["steps"] = [
        {
            key: "total_views",
            label: "Visitas totales",
            value: currentStats.summary.totalViews,
            shareOfFirstStep: firstStepValue > 0 ? 1 : 0,
            conversionFromPrevious: null,
        },
        {
            key: "unique_visitors",
            label: "Visitas únicas",
            value: currentStats.summary.uniqueVisitors,
            shareOfFirstStep: safeDivide(currentStats.summary.uniqueVisitors, firstStepValue),
            conversionFromPrevious: safeDivide(
                currentStats.summary.uniqueVisitors,
                currentStats.summary.totalViews
            ),
        },
        {
            key: "message_threads",
            label: "Conversaciones iniciadas",
            value: currentStats.summary.messageThreads,
            shareOfFirstStep: safeDivide(currentStats.summary.messageThreads, firstStepValue),
            conversionFromPrevious: safeDivide(
                currentStats.summary.messageThreads,
                currentStats.summary.uniqueVisitors
            ),
        },
    ];

    const currentOverallRate = safeDivide(
        currentStats.summary.messageThreads,
        currentStats.summary.totalViews
    );
    const previousOverallRate = safeDivide(
        previousStats.summary.messageThreads,
        previousStats.summary.totalViews
    );

    return {
        steps,
        overallConversionRate: currentOverallRate,
        previousOverallConversionRate: previousOverallRate,
        delta: buildDelta(currentOverallRate, previousOverallRate),
    };
};

const hasProductActivity = (row: EngagementByProduct | undefined): boolean => {
    if (!row) {
        return false;
    }

    return row.totalViews > 0 || row.messagesTotal > 0 || row.messageThreads > 0;
};

const createBackendOpportunityInsight = (
    currentStats: CompanyEngagementStats
): CompanyAdvancedStatsInsight | null => {
    const opportunity = currentStats.opportunities.highInterestLowConversion;
    if (!opportunity) {
        return null;
    }

    return {
        key: `backend-opportunity-${opportunity.productId}`,
        title: "Mucho interés, poca conversación",
        description: `${opportunity.productName} concentra tráfico relevante, pero convierte por debajo de lo deseable a conversación.`,
        severity: "warning",
        productId: opportunity.productId,
        productName: opportunity.productName,
        metrics: [
            buildInsightMetric("Visitas únicas", opportunity.uniqueVisitors, "count"),
            buildInsightMetric("Visita a conversación", safeDivide(opportunity.messageThreads, opportunity.totalViews), "percentage"),
            buildInsightMetric("Mensaje a alquiler", opportunity.messageToRentalRatio, "percentage"),
        ],
    };
};

const buildInsights = (
    currentStats: CompanyEngagementStats,
    productRows: CompanyAdvancedStatsProductRow[],
    publishedProducts: Product[]
): CompanyAdvancedStatsInsight[] => {
    const insights: CompanyAdvancedStatsInsight[] = [];
    const seenKeys = new Set<string>();

    const pushInsight = (insight: CompanyAdvancedStatsInsight | null) => {
        if (!insight || seenKeys.has(insight.key)) {
            return;
        }

        seenKeys.add(insight.key);
        insights.push(insight);
    };

    pushInsight(createBackendOpportunityInsight(currentStats));

    const rowsWithTraffic = productRows.filter((row) => row.uniqueVisitors > 0);
    const trafficValues = rowsWithTraffic.map((row) => row.uniqueVisitors);
    const conversionValues = rowsWithTraffic.map((row) => row.visitToConversationRate);

    const traffic75 = percentile(trafficValues, 0.75);
    const traffic25 = percentile(trafficValues, 0.25);
    const conversion75 = percentile(conversionValues, 0.75);
    const conversion25 = percentile(conversionValues, 0.25);

    rowsWithTraffic
        .filter(
            (row) =>
                row.uniqueVisitors >= traffic75 &&
                row.visitToConversationRate <= conversion25
        )
        .slice(0, 2)
        .forEach((row) => {
            pushInsight({
                key: `high-traffic-low-conversion-${row.productId}`,
                title: "Mucho tráfico, poca conversión",
                description: `${row.productName} recibe muchas visitas, pero convierte poco a conversación en este rango.`,
                severity: "warning",
                productId: row.productId,
                productName: row.productName,
                metrics: [
                    buildInsightMetric("Visitas únicas", row.uniqueVisitors, "count"),
                    buildInsightMetric("Visita a conversación", row.visitToConversationRate, "percentage"),
                ],
            });
        });

    rowsWithTraffic
        .filter(
            (row) =>
                row.uniqueVisitors <= traffic25 &&
                row.visitToConversationRate >= conversion75 &&
                row.messageThreads > 0
        )
        .slice(0, 2)
        .forEach((row) => {
            pushInsight({
                key: `low-traffic-high-conversion-${row.productId}`,
                title: "Alta conversión con poco tráfico",
                description: `${row.productName} convierte bien cuando recibe visitas. Puede ser buen candidato para ganar visibilidad.`,
                severity: "success",
                productId: row.productId,
                productName: row.productName,
                metrics: [
                    buildInsightMetric("Visitas únicas", row.uniqueVisitors, "count"),
                    buildInsightMetric("Visita a conversación", row.visitToConversationRate, "percentage"),
                ],
            });
        });

    if ((currentStats.summary.averageFirstResponseMinutes ?? 0) > 120) {
        pushInsight({
            key: "response-time-improvement",
            title: "Tiempo de respuesta mejorable",
            description: "La media de primera respuesta supera las 2 horas. Responder antes puede mejorar la conversión a alquiler.",
            severity: "warning",
            metrics: [
                buildInsightMetric(
                    "1ª respuesta media",
                    currentStats.summary.averageFirstResponseMinutes ?? 0,
                    "duration_minutes"
                ),
                buildInsightMetric(
                    "Mensaje a alquiler",
                    currentStats.summary.messageToRentalRatio,
                    "percentage"
                ),
            ],
        });
    }

    const activityByProductId = new Map(
        currentStats.byProduct.map((row) => [row.productId, row])
    );

    publishedProducts
        .filter((product) => !hasProductActivity(activityByProductId.get(product.id)))
        .slice(0, MAX_DORMANT_INSIGHTS)
        .forEach((product) => {
            pushInsight({
                key: `dormant-product-${product.id}`,
                title: "Producto sin actividad reciente",
                description: `${product.name} no ha registrado visitas ni conversaciones en el rango actual.`,
                severity: "info",
                productId: product.id,
                productName: product.name,
                metrics: [
                    buildInsightMetric("Visitas", 0, "count"),
                    buildInsightMetric("Conversaciones", 0, "count"),
                ],
            });
        });

    return insights;
};

export class CompanyAdvancedStatsService {
    constructor(
        private readonly companyEngagementRepository: CompanyEngagementRepository,
        private readonly productRepository: ProductRepository
    ) {
    }

    async getCompanyAdvancedStats(
        companyId: string,
        period?: { from?: string; to?: string }
    ): Promise<CompanyAdvancedStats> {
        const currentStats = await this.companyEngagementRepository.getCompanyStats(companyId, period);
        const resolvedPeriod = resolvePeriod(currentStats.period);
        const previousPeriod = buildPreviousPeriod(resolvedPeriod);

        const [previousStats, publishedProducts] = await Promise.all([
            this.companyEngagementRepository.getCompanyStats(companyId, previousPeriod),
            this.listPublishedCompanyProducts(companyId),
        ]);

        const productsById = new Map(publishedProducts.map((product) => [product.id, product]));
        const previousRowsById = new Map(
            previousStats.byProduct.map((row) => [row.productId, row])
        );
        const productConversionRows = currentStats.byProduct.map((row) =>
            buildProductRow(row, previousRowsById.get(row.productId), productsById)
        );

        const averageFirstResponseKpi = buildRateKpi(
            "average_first_response_minutes",
            "1ª respuesta media",
            "Tiempo medio hasta la primera respuesta enviada por tu equipo.",
            currentStats.summary.averageFirstResponseMinutes,
            previousStats.summary.averageFirstResponseMinutes,
            "lower"
        );

        const conversionKpis: CompanyAdvancedStatsKpi[] = [
            buildRateKpi(
                "visit_to_conversation",
                "Visita -> conversación",
                "Conversaciones iniciadas sobre el total de visitas del período.",
                safeDivide(currentStats.summary.messageThreads, currentStats.summary.totalViews),
                safeDivide(previousStats.summary.messageThreads, previousStats.summary.totalViews),
                "higher"
            ),
            buildRateKpi(
                "unique_to_conversation",
                "Única -> conversación",
                "Conversaciones iniciadas sobre visitas únicas del período.",
                safeDivide(currentStats.summary.messageThreads, currentStats.summary.uniqueVisitors),
                safeDivide(previousStats.summary.messageThreads, previousStats.summary.uniqueVisitors),
                "higher"
            ),
            buildRateKpi(
                "message_to_rental",
                "Mensaje -> alquiler",
                "Conversaciones que terminan en alquiler confirmado.",
                currentStats.summary.messageToRentalRatio,
                previousStats.summary.messageToRentalRatio,
                "higher"
            ),
            averageFirstResponseKpi,
        ];

        const insights = buildInsights(currentStats, productConversionRows, publishedProducts);
        const funnel = buildFunnel(currentStats, previousStats);
        const hasAnyData =
            currentStats.summary.totalViews > 0 ||
            currentStats.summary.messageThreads > 0 ||
            productConversionRows.length > 0 ||
            insights.length > 0;

        return {
            companyId,
            period: resolvedPeriod,
            previousPeriod,
            funnel,
            conversionKpis,
            responsePerformance: {
                averageFirstResponse: averageFirstResponseKpi,
                helperText: "Tiempo medio hasta la primera respuesta enviada por tu equipo. Otras lecturas de atención se añadirán cuando haya datos suficientes.",
            },
            productConversionRows,
            insights,
            sectionAvailability: {
                funnel: { available: true },
                conversionRates: { available: true },
                responsePerformance: {
                    available: true,
                    partial: true,
                    reason: "Por ahora sólo hay tiempo medio de primera respuesta.",
                },
                trafficSources: {
                    available: false,
                    reason: "El desglose por canal de adquisición todavía no está disponible.",
                },
                lostDemand: {
                    available: false,
                    reason: "La demanda perdida por disponibilidad o fechas todavía no está disponible.",
                },
            },
            exportReadiness: {
                csv: {
                    available: false,
                    reason: "La exportación CSV se activará más adelante.",
                },
                pdf: {
                    available: false,
                    reason: "La exportación PDF se activará más adelante.",
                },
            },
            hasAnyData,
        };
    }

    private async listPublishedCompanyProducts(companyId: string): Promise<Product[]> {
        const products: Product[] = [];
        let page = 1;
        let total = 0;

        do {
            const response = await this.productRepository.listByOwnerPaginated(
                companyId,
                "company",
                page,
                COMPANY_PRODUCTS_PAGE_SIZE,
                { publicationStatus: "published" }
            );

            total = response.total ?? response.data.length;
            products.push(...response.data);
            page += 1;

            if (response.data.length === 0) {
                break;
            }
        } while (products.length < total);

        const seenIds = new Set<string>();
        return products.filter((product) => {
            if (seenIds.has(product.id)) {
                return false;
            }

            seenIds.add(product.id);
            return true;
        });
    }
}
