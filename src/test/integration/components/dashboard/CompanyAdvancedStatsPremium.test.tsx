import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { CompanyAdvancedStatsPremium } from "@/components/dashboard/stats/CompanyAdvancedStatsPremium";
import type { CompanyAdvancedStats } from "@/domain/models/CompanyAdvancedStats";

const useCompanyAdvancedStatsMock = vi.fn();

vi.mock("@/application/hooks/useCompanyAdvancedStats", () => ({
    useCompanyAdvancedStats: (...args: unknown[]) => useCompanyAdvancedStatsMock(...args),
}));

const advancedStatsFixture: CompanyAdvancedStats = {
    companyId: "company-1",
    period: { from: "2026-04-01", to: "2026-04-07" },
    previousPeriod: { from: "2026-03-25", to: "2026-03-31" },
    funnel: {
        steps: [
            {
                key: "total_views",
                label: "Visitas totales",
                value: 200,
                shareOfFirstStep: 1,
                conversionFromPrevious: null,
            },
            {
                key: "unique_visitors",
                label: "Visitas únicas",
                value: 120,
                shareOfFirstStep: 0.6,
                conversionFromPrevious: 0.6,
            },
            {
                key: "message_threads",
                label: "Conversaciones iniciadas",
                value: 30,
                shareOfFirstStep: 0.15,
                conversionFromPrevious: 0.25,
            },
        ],
        overallConversionRate: 0.15,
        previousOverallConversionRate: 0.1,
        delta: {
            kind: "increase",
            absoluteChange: 0.05,
            percentageChange: 50,
        },
    },
    conversionKpis: [
        {
            key: "visit_to_conversation",
            label: "Visita -> conversación",
            description: "desc",
            format: "percentage",
            trendPreference: "higher",
            currentValue: 0.15,
            previousValue: 0.1,
            delta: { kind: "increase", absoluteChange: 0.05, percentageChange: 50 },
        },
        {
            key: "unique_to_conversation",
            label: "Única -> conversación",
            description: "desc",
            format: "percentage",
            trendPreference: "higher",
            currentValue: 0.25,
            previousValue: 0.2,
            delta: { kind: "increase", absoluteChange: 0.05, percentageChange: 25 },
        },
        {
            key: "message_to_rental",
            label: "Mensaje -> alquiler",
            description: "desc",
            format: "percentage",
            trendPreference: "higher",
            currentValue: 0.4,
            previousValue: 0.2,
            delta: { kind: "increase", absoluteChange: 0.2, percentageChange: 100 },
        },
        {
            key: "average_first_response_minutes",
            label: "1ª respuesta media",
            description: "desc",
            format: "duration_minutes",
            trendPreference: "lower",
            currentValue: 85,
            previousValue: 120,
            delta: { kind: "decrease", absoluteChange: -35, percentageChange: -29.17 },
        },
    ],
    responsePerformance: {
        averageFirstResponse: {
            key: "average_first_response_minutes",
            label: "1ª respuesta media",
            description: "desc",
            format: "duration_minutes",
            trendPreference: "lower",
            currentValue: 85,
            previousValue: 120,
            delta: { kind: "decrease", absoluteChange: -35, percentageChange: -29.17 },
        },
        helperText: "Texto helper",
    },
    productConversionRows: [
        {
            productId: "product-1",
            productName: "Taladro Pro",
            productSlug: "taladro-pro",
            productInternalId: "TLD-001",
            totalViews: 120,
            uniqueVisitors: 90,
            messageThreads: 5,
            visitToConversationRate: 0.0417,
            uniqueToConversationRate: 0.0556,
            messageToRentalRate: 0.15,
            deltaVsPrevious: {
                kind: "decrease",
                absoluteChange: -0.02,
                percentageChange: -32,
            },
        },
    ],
    insights: [
        {
            key: "dormant-product-product-3",
            title: "Producto sin actividad reciente",
            description: "Mesa Corte no ha registrado actividad.",
            severity: "info",
            productId: "product-3",
            productName: "Mesa Corte",
            metrics: [
                { label: "Visitas", value: 0, format: "count" },
                { label: "Conversaciones", value: 0, format: "count" },
            ],
        },
    ],
    sectionAvailability: {
        funnel: { available: true },
        conversionRates: { available: true },
        responsePerformance: { available: true, partial: true, reason: "Texto helper" },
        trafficSources: { available: false, reason: "Sin canales" },
        lostDemand: { available: false, reason: "Sin demanda perdida" },
    },
    exportReadiness: {
        csv: { available: false, reason: "No listo" },
        pdf: { available: false, reason: "No listo" },
    },
    hasAnyData: true,
};

describe("CompanyAdvancedStatsPremium", () => {
    beforeEach(() => {
        useCompanyAdvancedStatsMock.mockReset();
    });

    it("renders a teaser when the company does not have premium access", () => {
        useCompanyAdvancedStatsMock.mockReturnValue({
            isLoading: false,
            error: null,
            data: undefined,
        });

        render(
            <CompanyAdvancedStatsPremium
                companyId="company-1"
                period={{ from: "2026-04-01", to: "2026-04-07" }}
                hasAccess={false}
            />
        );

        expect(screen.getByText("Rendimiento comercial")).toBeInTheDocument();
        expect(screen.getByText(/Disponible para empresas con acceso a este bloque/i)).toBeInTheDocument();
        expect(screen.getByText("Acceso adicional")).toBeInTheDocument();
    });

    it("renders loading state while the premium query resolves", () => {
        useCompanyAdvancedStatsMock.mockReturnValue({
            isLoading: true,
            error: null,
            data: undefined,
        });

        render(
            <CompanyAdvancedStatsPremium
                companyId="company-1"
                period={{ from: "2026-04-01", to: "2026-04-07" }}
                hasAccess={true}
            />
        );

        expect(screen.getByText(/Cargando métricas de rendimiento/i)).toBeInTheDocument();
    });

    it("renders funnel, compact product highlights and deterministic signals when data is available", () => {
        useCompanyAdvancedStatsMock.mockReturnValue({
            isLoading: false,
            error: null,
            data: advancedStatsFixture,
        });

        render(
            <CompanyAdvancedStatsPremium
                companyId="company-1"
                period={{ from: "2026-04-01", to: "2026-04-07" }}
                hasAccess={true}
            />
        );

        expect(screen.getByText("Embudo de conversión")).toBeInTheDocument();
        expect(screen.getByText("Lecturas por producto")).toBeInTheDocument();
        expect(screen.getByText("Señales automáticas")).toBeInTheDocument();
        expect(screen.getByText("Producto sin actividad reciente")).toBeInTheDocument();
        expect(screen.getByText("Taladro Pro")).toBeInTheDocument();
    }, 15000);

    it("renders commercial performance and funnel placeholders when premium stats have no data", () => {
        useCompanyAdvancedStatsMock.mockReturnValue({
            isLoading: false,
            error: null,
            data: {
                ...advancedStatsFixture,
                funnel: {
                    ...advancedStatsFixture.funnel,
                    steps: advancedStatsFixture.funnel.steps.map((step) => ({
                        ...step,
                        value: 0,
                        shareOfFirstStep: 0,
                        conversionFromPrevious: step.conversionFromPrevious == null ? null : 0,
                    })),
                    overallConversionRate: 0,
                    previousOverallConversionRate: 0,
                    delta: { kind: "neutral", absoluteChange: 0, percentageChange: 0 },
                },
                conversionKpis: advancedStatsFixture.conversionKpis.map((kpi) => ({
                    ...kpi,
                    currentValue: kpi.key === "average_first_response_minutes" ? null : 0,
                    previousValue: kpi.key === "average_first_response_minutes" ? null : 0,
                    delta: { kind: "neutral", absoluteChange: 0, percentageChange: 0 },
                })),
                responsePerformance: {
                    ...advancedStatsFixture.responsePerformance,
                    averageFirstResponse: {
                        ...advancedStatsFixture.responsePerformance.averageFirstResponse,
                        currentValue: null,
                        previousValue: null,
                        delta: { kind: "neutral", absoluteChange: 0, percentageChange: 0 },
                    },
                },
                productConversionRows: [],
                insights: [],
                hasAnyData: false,
            },
        });

        render(
            <CompanyAdvancedStatsPremium
                companyId="company-1"
                period={{ from: "2026-04-01", to: "2026-04-07" }}
                hasAccess={true}
            />
        );

        expect(screen.getByText("Rendimiento comercial")).toBeInTheDocument();
        expect(screen.getByText("Embudo de conversión")).toBeInTheDocument();
        expect(screen.getByText("Sin lecturas destacadas por producto para este rango todavía.")).toBeInTheDocument();
        expect(screen.getByText("No hay señales relevantes para este rango todavía.")).toBeInTheDocument();
    });
});
