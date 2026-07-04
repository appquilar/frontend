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
const uploadImageMock = vi.fn();
const deleteImageMock = vi.fn();
const mutateAsyncMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/application/hooks/useCompanyProfile", () => ({
  useCompanyProfile: (...args: unknown[]) => useCompanyProfileMock(...args),
  useUpdateCompanyProfile: () => useUpdateCompanyProfileMock(),
}));

vi.mock("@/application/hooks/useMediaActions", () => ({
  useMediaActions: () => ({
    uploadImage: uploadImageMock,
    deleteImage: deleteImageMock,
  }),
}));

vi.mock("@/components/dashboard/hooks/useAddressMap", () => ({
  useAddressMap: (...args: unknown[]) => useAddressMapMock(...args),
}));

vi.mock("@/components/dashboard/companies/CompanySubscriptionSettingsCard", () => ({
  default: () => <div>subscription-settings-card</div>,
}));

vi.mock("@/components/dashboard/stats/AdminCompanyStatsSection", () => ({
  AdminCompanyStatsSection: () => <div>admin-company-stats</div>,
}));

vi.mock("@/components/dashboard/common/FormHeader", () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/components/dashboard/common/LoadingSpinner", () => ({
  default: () => <div>loading-company-form</div>,
}));

vi.mock("@/components/dashboard/companies/CompanyImageField", () => ({
  default: ({
    title,
    mediaId,
    isUploading,
    error,
    onSelectFile,
    onRemove,
  }: {
    title: string;
    mediaId: string | null;
    isUploading: boolean;
    error?: string;
    onSelectFile: (file: File) => Promise<void>;
    onRemove: () => Promise<void>;
  }) => (
    <div>
      <p>{title}</p>
      <p>{mediaId ?? "sin-imagen"}</p>
      {isUploading ? <p>subiendo-{title}</p> : null}
      {error ? <p>{error}</p> : null}
      <button
        type="button"
        onClick={() => {
          void onSelectFile(new File(["gif"], `${title}.gif`, { type: "image/gif" }));
        }}
      >
        subir gif {title}
      </button>
      <button
        type="button"
        onClick={() => {
          void onSelectFile(new File(["png"], `${title}.png`, { type: "image/png" }));
        }}
      >
        subir png {title}
      </button>
      <button
        type="button"
        onClick={() => {
          void onRemove();
        }}
      >
        quitar {title}
      </button>
    </div>
  ),
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
  profilePictureId: "00000000-0000-4000-8000-000000000001",
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

describe("CompanyFormPage image handling", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useCompanyProfileMock.mockReset();
    useUpdateCompanyProfileMock.mockReset();
    useAddressMapMock.mockReset();
    uploadImageMock.mockReset();
    deleteImageMock.mockReset();
    mutateAsyncMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();

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

  it("shows a validation error when the user selects an unsupported image type", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
      </Routes>,
      { route: "/dashboard/companies/company-1" }
    );

    await user.click(screen.getByRole("button", { name: "subir gif Imagen de perfil" }));

    expect(await screen.findByText("Usa una imagen JPEG o PNG.")).toBeInTheDocument();
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it("shows an inline error when an image upload fails", async () => {
    const user = userEvent.setup();
    uploadImageMock.mockRejectedValueOnce(new Error("upload failed"));

    renderWithProviders(
      <Routes>
        <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
      </Routes>,
      { route: "/dashboard/companies/company-1" }
    );

    await user.click(screen.getByRole("button", { name: "subir png Imagen de cabecera" }));

    expect(await screen.findByText("No se pudo subir la imagen.")).toBeInTheDocument();
    expect(uploadImageMock).toHaveBeenCalledTimes(1);
  });

  it("replaces temporary uploads and removes the persisted image after a successful save", async () => {
    const user = userEvent.setup();

    uploadImageMock
      .mockResolvedValueOnce("00000000-0000-4000-8000-000000000101")
      .mockResolvedValueOnce("00000000-0000-4000-8000-000000000102");
    mutateAsyncMock.mockResolvedValue(undefined);

    renderWithProviders(
      <Routes>
        <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
      </Routes>,
      { route: "/dashboard/companies/company-1" }
    );

    await user.click(screen.getByRole("button", { name: "subir png Imagen de perfil" }));
    await user.click(screen.getByRole("button", { name: "subir png Imagen de perfil" }));

    await waitFor(() => {
      expect(deleteImageMock).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000101");
    });

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-1",
          profilePictureId: "00000000-0000-4000-8000-000000000102",
        })
      );
      expect(toastSuccessMock).toHaveBeenCalledWith("Empresa actualizada correctamente.");
      expect(deleteImageMock).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
    });
  });

  it("deletes temporary images when the user removes them before saving", async () => {
    const user = userEvent.setup();

    useCompanyProfileMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...companyProfileFixture,
        profilePictureId: null,
      },
    });
    uploadImageMock.mockResolvedValueOnce("00000000-0000-4000-8000-000000000201");
    mutateAsyncMock.mockResolvedValue(undefined);

    renderWithProviders(
      <Routes>
        <Route path="/dashboard/companies/:id" element={<CompanyFormPage />} />
      </Routes>,
      { route: "/dashboard/companies/company-1" }
    );

    await user.click(screen.getByRole("button", { name: "subir png Imagen de perfil" }));
    await user.click(screen.getByRole("button", { name: "quitar Imagen de perfil" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(deleteImageMock).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000201");
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          profilePictureId: null,
        })
      );
    });
  });
});
