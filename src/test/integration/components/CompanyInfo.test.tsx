import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import CompanyInfo from "@/components/products/CompanyInfo";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const { usePublicCompanyProfileMock } = vi.hoisted(() => ({
    usePublicCompanyProfileMock: vi.fn(),
}));

vi.mock("@/application/hooks/usePublicCompanyProfile", () => ({
    usePublicCompanyProfile: usePublicCompanyProfileMock,
}));

describe("CompanyInfo", () => {
    it("links to the public company page without anonymous contact CTA", () => {
        usePublicCompanyProfileMock.mockReturnValue({
            data: {
                name: "Empresote",
                slug: "empresote",
                description: "Catálogo profesional para eventos.",
                profilePictureId: null,
                headerImageId: null,
                location: {
                    city: "Mataró",
                    state: "Catalunya",
                    country: "España",
                    displayLabel: "Mataró, Catalunya, España",
                },
                address: null,
                geoLocation: null,
            },
        });

        renderWithProviders(
            <CompanyInfo
                company={{ id: "company-1", name: "Empresote", slug: "empresote" }}
                locationLabel="Mataró, Catalunya, España"
                onContact={vi.fn()}
                isLoggedIn={false}
            />
        );

        expect(screen.getByRole("link", { name: "Empresote" })).toHaveAttribute("href", "/empresa/empresote");
        expect(screen.getByRole("link", { name: "Ver empresa" })).toHaveAttribute("href", "/empresa/empresote");
        expect(screen.getByText("Catálogo profesional para eventos.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Crear cuenta para contactar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Solicitar alquiler" })).not.toBeInTheDocument();
    });
});
