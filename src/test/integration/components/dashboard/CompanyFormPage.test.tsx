import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";

import CompanyFormPage from "@/components/dashboard/companies/CompanyFormPage";
import { UserRole } from "@/domain/models/UserRole";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const useAuthMock = vi.fn();
const useCompanyProfileMock = vi.fn();
const useUpdateCompanyProfileMock = vi.fn();
const useAddressMapMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const mutateAsyncMock = vi.fn();

vi.mock("@/context/AuthContext", () => ({
    useAuth: () => useAuthMock(),
}));

vi.mock("@/application/hooks/useCompanyProfile", () => ({
    useCompanyProfile: (...args: unknown[]) => useCompanyProfileMock(...args),
    useUpdateCompanyProfile: () => useUpdateCompanyProfileMock(),
}));

vi.mock("@/components/dashboard/hooks/useAddressMap", () => ({
    useAddressMap: (...args: unknown[]) => useAddressMapMock(...args),
}));

vi.mock("@/components/dashboard/companies/CompanySubscriptionSettingsCard", () => ({
    default: () => <div>subscription-settings-card</div>,
}));

vi.mock("@/components/dashboard/stats/AdminCompanyStatsSection", () => ({
    AdminCompanyStatsSection: ({ companyId }: { companyId: string }) => (
        <div>admin-company-stats-{companyId}</div>
    ),
}));

vi.mock("@/components/dashboard/common/LoadingSpinner", () => ({
    default: () => <div>loading-company-form</div>,
}));

vi.mock("sonner", () => ({
    toast: {
        success: (...args: unknown[]) => toastSuccessMock(...args),
        error: (...args: unknown[]) => toastErrorMock(...args),
    },
}));

const companyProfileFixture = {
    id: "company-1",
    name: "Empresote",
    slug: "empresote",
    description: "Empresa de alquiler industrial",
    fiscalIdentifier: "B123456789",
    contactEmail: "contacto@empresote.com",
    phoneNumber: null,
    profilePictureId: null,
    headerImageId: null,
    address: {
        street: "Calle Mayor 1",
        street2: "",
        city: "Madrid",
        state: "Madrid",
        country: "España",
        postalCode: "28001",
    },
    location: {
        latitude: 40.4168,
        longitude: -3.7038,
    },
};

describe("CompanyFormPage", () => {
    beforeEach(() => {
        useAuthMock.mockReset();
        useCompanyProfileMock.mockReset();
        useUpdateCompanyProfileMock.mockReset();
        toastSuccessMock.mockReset();
        toastErrorMock.mockReset();
        mutateAsyncMock.mockReset();

        useAuthMock.mockReturnValue({
            currentUser: {
                companyId: "company-1",
                isCompanyOwner: true,
                roles: [UserRole.REGULAR_USER],
            },
            hasRole: vi.fn().mockReturnValue(false),
        });

        useCompanyProfileMock.mockReturnValue({
            isLoading: false,
            isError: false,
            data: companyProfileFixture,
        });

        useUpdateCompanyProfileMock.mockReturnValue({
            isPending: false,
            mutateAsync: mutateAsyncMock,
        });

        useAddressMapMock.mockReturnValue({
            autocompleteContainerRef: { current: null },
            mapContainerRef: { current: null },
            isMapsLoading: false,
            mapsError: null,
        });
    });

    it("uses the shared phone input and submits the expected company phone payload", async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <Routes>
                <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
            </Routes>,
            { route: "/dashboard/companies/company-1" }
        );

        expect(
            screen.getByRole("combobox", { name: "Seleccionar país y prefijo telefónico" })
        ).toBeInTheDocument();
        expect(screen.getByText("Identidad y contacto")).toBeInTheDocument();
        expect(screen.getByText("Dirección y ubicación")).toBeInTheDocument();

        const phoneInput = screen.getByLabelText("Número de teléfono");
        await user.type(phoneInput, "637493915");
        await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(mutateAsyncMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    companyId: "company-1",
                    phoneNumber: {
                        countryCode: "ES",
                        prefix: "+34",
                        number: "637493915",
                    },
                })
            );
        });
    });

    it("shows the phone validation error inside the form", async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <Routes>
                <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
            </Routes>,
            { route: "/dashboard/companies/company-1" }
        );

        const phoneInput = screen.getByLabelText("Número de teléfono");
        await user.type(phoneInput, "123");
        await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

        expect(await screen.findByText("Debe ser un número de teléfono válido")).toBeInTheDocument();
        expect(mutateAsyncMock).not.toHaveBeenCalled();
    });

    it("returns an empty-company fallback when no route or session company can be resolved", () => {
        useAuthMock.mockReturnValue({
            currentUser: {
                companyId: null,
                roles: [UserRole.REGULAR_USER],
            },
            hasRole: vi.fn().mockReturnValue(false),
        });

        renderWithProviders(
            <Routes>
                <Route path="/" element={<CompanyFormPage />} />
            </Routes>,
            { route: "/" }
        );

        expect(screen.getByText("No hay empresa asociada a tu usuario.")).toBeInTheDocument();
    });

    it("renders loading and error states from the company profile query", () => {
        useCompanyProfileMock.mockReturnValueOnce({
            isLoading: true,
            isError: false,
            data: undefined,
        });

        const { rerender } = renderWithProviders(
            <Routes>
                <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
            </Routes>,
            { route: "/dashboard/companies/company-1" }
        );

        expect(screen.getByText("loading-company-form")).toBeInTheDocument();

        useCompanyProfileMock.mockReturnValueOnce({
            isLoading: false,
            isError: true,
            data: undefined,
        });

        rerender(
            <Routes>
                <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
            </Routes>
        );

        expect(screen.getByText("No se pudo cargar la información de la empresa.")).toBeInTheDocument();
    });

    it("submits a null phone payload when the company has no contact phone", async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <Routes>
                <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
            </Routes>,
            { route: "/dashboard/companies/company-1" }
        );

        await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(mutateAsyncMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    companyId: "company-1",
                    phoneNumber: null,
                })
            );
        });
    });

    it("shows map and save errors and renders the admin stats section for platform admins", async () => {
        const user = userEvent.setup();
        mutateAsyncMock.mockRejectedValueOnce(new Error("save failed"));
        useAuthMock.mockReturnValue({
            currentUser: {
                companyId: "company-1",
                roles: [UserRole.ADMIN],
            },
            hasRole: vi.fn((role: UserRole) => role === UserRole.ADMIN),
        });
        useAddressMapMock.mockReturnValue({
            autocompleteContainerRef: { current: null },
            mapContainerRef: { current: null },
            isMapsLoading: false,
            mapsError: "Maps no disponible",
        });

        renderWithProviders(
            <Routes>
                <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
            </Routes>,
            { route: "/dashboard/companies/company-1" }
        );

        expect(screen.getByText("Maps no disponible")).toBeInTheDocument();
        expect(screen.getByText("admin-company-stats-company-1")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(toastErrorMock).toHaveBeenCalledWith("No se pudo guardar la empresa.");
        });
    });
});
