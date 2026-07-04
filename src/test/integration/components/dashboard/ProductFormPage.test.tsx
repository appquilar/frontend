import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";

import ProductFormPage from "@/components/dashboard/products/ProductFormPage";
import type { Product } from "@/domain/models/Product";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const {
  createProductMutateMock,
  updateProductMutateMock,
  useProductMock,
  useProductOwnerAddressMock,
  useProductPublicationLimitMock,
  productEditFormState,
} = vi.hoisted(() => ({
  createProductMutateMock: vi.fn(),
  updateProductMutateMock: vi.fn(),
  useProductMock: vi.fn(),
  useProductOwnerAddressMock: vi.fn(),
  useProductPublicationLimitMock: vi.fn(),
  productEditFormState: {
    payload: {} as Partial<Product>,
  },
}));

vi.mock("@/application/hooks/useProducts", () => ({
  useCreateProduct: () => ({
    mutateAsync: createProductMutateMock,
  }),
  useUpdateProduct: () => ({
    mutateAsync: updateProductMutateMock,
  }),
  useProduct: (...args: unknown[]) => useProductMock(...args),
}));

vi.mock("@/application/hooks/useProductOwnerAddress", () => ({
  useProductOwnerAddress: () => useProductOwnerAddressMock(),
}));

vi.mock("@/components/dashboard/products/hooks/useProductPublicationLimit", () => ({
  useProductPublicationLimit: () => useProductPublicationLimitMock(),
}));

vi.mock("@/components/dashboard/ProductEditForm", () => ({
  default: ({ onSave }: { onSave: (product: Partial<Product>) => void }) => (
    <button type="button" onClick={() => onSave(productEditFormState.payload)}>
      save-product
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const LocationDisplay = () => {
  const location = useLocation();

  return <div data-testid="location-display">{location.pathname}</div>;
};

describe("ProductFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createProductMutateMock.mockResolvedValue(undefined);
    updateProductMutateMock.mockResolvedValue(undefined);
    useProductMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    useProductOwnerAddressMock.mockReturnValue({
      hasRequiredAddress: true,
      isLoading: false,
      ownerType: "company",
      companyId: "company-1",
      settingsHref: "/dashboard/companies/company-1",
    });
    useProductPublicationLimitMock.mockReturnValue({
      hasReachedProductPublicationLimit: false,
      publicationLimitCtaLabel: null,
      handlePublicationLimitCta: vi.fn(),
      isProcessingPublicationLimitCta: false,
      isPublicationLimitLoading: false,
    });
    productEditFormState.payload = {
      id: "product-1",
      name: "Castillo inflable",
      slug: "castillo-inflable",
      description: "Inflable para fiestas",
      internalId: "INV-001",
      quantity: 5,
      isRentalEnabled: true,
      isInventoryEnabled: true,
      imageUrl: "",
      thumbnailUrl: "",
      publicationStatus: "draft",
      price: {
        daily: 5000,
        deposit: 10000,
        tiers: [],
      },
      category: {
        id: "category-1",
        name: "Fiestas",
        slug: "fiestas",
      },
      rating: 0,
      reviewCount: 0,
      productType: "rental",
      dynamicProperties: {
        montaje_incluido: true,
      },
    };
  });

  it("does not render the product form when the publication limit is reached", () => {
    useProductPublicationLimitMock.mockReturnValue({
      hasReachedProductPublicationLimit: true,
      publicationLimitCtaLabel: "Hazte Pro",
      handlePublicationLimitCta: vi.fn(),
      isProcessingPublicationLimitCta: false,
      isPublicationLimitLoading: false,
    });

    renderWithProviders(
      <Routes>
        <Route path="/dashboard/products/:productId" element={<ProductFormPage />} />
        <Route path="/dashboard/products" element={<div>products-list</div>} />
      </Routes>,
      { route: "/dashboard/products/new" }
    );

    expect(screen.getByText("Límite de productos alcanzado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "save-product" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hazte Pro" })).toBeInTheDocument();
  });

  it("sends the active company id when creating a company product", async () => {
    const user = userEvent.setup();
    useProductMock.mockReturnValue({
      data: {
        ...productEditFormState.payload,
        id: "product-1",
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(
      <>
        <Routes>
          <Route path="/dashboard/products/:productId" element={<ProductFormPage />} />
          <Route path="/dashboard/products" element={<div>products-list</div>} />
        </Routes>
        <LocationDisplay />
      </>,
      { route: "/dashboard/products/new" }
    );

    await user.click(screen.getByRole("button", { name: "save-product" }));

    await waitFor(() => {
      expect(createProductMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-1",
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("products-list")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("location-display")).toHaveTextContent("/dashboard/products/product-1");
  });

  it("removes stale company scope when creating a personal product", async () => {
    const user = userEvent.setup();
    useProductMock.mockReturnValue({
      data: {
        ...productEditFormState.payload,
        id: "product-1",
      },
      isLoading: false,
      error: null,
    });

    useProductOwnerAddressMock.mockReturnValue({
      hasRequiredAddress: true,
      isLoading: false,
      ownerType: "user",
      companyId: null,
      settingsHref: "/dashboard/config?tab=address",
    });
    productEditFormState.payload = {
      ...productEditFormState.payload,
      companyId: "company-1",
    } as Partial<Product>;

    renderWithProviders(
      <Routes>
        <Route path="/dashboard/products/:productId" element={<ProductFormPage />} />
        <Route path="/dashboard/products" element={<div>products-list</div>} />
      </Routes>,
      { route: "/dashboard/products/new" }
    );

    await user.click(screen.getByRole("button", { name: "save-product" }));

    await waitFor(() => {
      expect(createProductMutateMock).toHaveBeenCalledTimes(1);
    });

    expect(createProductMutateMock.mock.calls[0]?.[0]?.companyId).toBeUndefined();
  });

  it("keeps the user on the same product route after updating", async () => {
    const user = userEvent.setup();

    useProductMock.mockReturnValue({
      data: {
        ...productEditFormState.payload,
        id: "product-1",
      },
      isLoading: false,
      error: null,
    });

    renderWithProviders(
      <>
        <Routes>
          <Route path="/dashboard/products/:productId/edit" element={<ProductFormPage />} />
          <Route path="/dashboard/products" element={<div>products-list</div>} />
        </Routes>
        <LocationDisplay />
      </>,
      { route: "/dashboard/products/product-1/edit" }
    );

    await user.click(screen.getByRole("button", { name: "save-product" }));

    await waitFor(() => {
      expect(updateProductMutateMock).toHaveBeenCalledWith({
        id: "product-1",
        data: productEditFormState.payload,
      });
    });

    expect(screen.getByTestId("location-display")).toHaveTextContent("/dashboard/products/product-1/edit");
    expect(screen.queryByText("products-list")).not.toBeInTheDocument();
  });
});
