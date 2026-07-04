import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductInfo from "@/components/products/ProductInfo";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const useProductRentabilityMock = vi.fn();
const openSignInMock = vi.fn();
const openSignUpMock = vi.fn();

vi.mock("@/application/hooks/useProductInventory", () => ({
  useProductRentability: (...args: unknown[]) => useProductRentabilityMock(...args),
}));

vi.mock("@/hooks/useAuthModalLauncher", () => ({
  useAuthModalLauncher: () => ({
    openSignIn: openSignInMock,
    openSignUp: openSignUpMock,
  }),
}));

vi.mock("@/components/products/ProductRentalCostCalculator", () => ({
  default: () => <div data-testid="rental-calculator">calculator</div>,
}));

vi.mock("@/components/products/CompanyInfo", () => ({
  default: ({
    locationLabel,
    onContact,
    isLoggedIn,
  }: {
    locationLabel?: string;
    onContact: () => void;
    isLoggedIn: boolean;
  }) => (
    <div>
      <p>{locationLabel}</p>
      <button type="button" onClick={onContact}>
        {isLoggedIn ? "Contactar empresa" : "Contactar como invitado"}
      </button>
    </div>
  ),
}));

const baseProps = {
  product: {
    id: "product-1",
    name: "Taladro premium",
    publicationStatus: "published",
    quantity: 1,
    isRentalEnabled: true,
    inventorySummary: null,
    category: {
      id: "category-1",
      name: "Herramientas",
      slug: "herramientas",
    },
    company: {
      id: "company-1",
      name: "Appquilar Tools",
      slug: "appquilar-tools",
    },
    price: {
      daily: 24.5,
      deposit: 80,
      tiers: [
        {
          daysFrom: 1,
          daysTo: 3,
          pricePerDay: 24.5,
        },
      ],
    },
    providerLocationLabel: "Madrid, Comunidad de Madrid",
  },
  onContact: vi.fn(),
  leadStartDate: "2026-04-20",
  leadEndDate: "2026-04-22",
  leadRequestedQuantity: 1,
  onLeadStartDateChange: vi.fn(),
  onLeadEndDateChange: vi.fn(),
  onLeadRequestedQuantityChange: vi.fn(),
  onLeadCalculationChange: vi.fn(),
};

describe("ProductInfo behavior", () => {
  beforeEach(() => {
    useProductRentabilityMock.mockReset();
    openSignInMock.mockReset();
    openSignUpMock.mockReset();
    baseProps.onContact.mockReset();

    useProductRentabilityMock.mockReturnValue({
      availabilityTone: "success",
      availabilityLabel: "Disponible",
      availabilityMessage: "Disponible para alquilar.",
      isRentableNow: true,
    });
  });

  it("opens the guest auth flows from the pricing CTA buttons and from the company contact action", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProductInfo {...baseProps} isLoggedIn={false} />);

    expect(screen.getByText(/El pago del alquiler y la fianza/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Crear cuenta gratis" }));
    await user.click(screen.getByRole("button", { name: "Ya tengo cuenta" }));
    await user.click(screen.getByRole("button", { name: "Contactar como invitado" }));

    expect(openSignUpMock).toHaveBeenNthCalledWith(1, undefined, "/");
    expect(openSignInMock).toHaveBeenCalledTimes(1);
    expect(openSignInMock).toHaveBeenCalledWith(undefined, "/");
    expect(openSignUpMock).toHaveBeenNthCalledWith(
      2,
      "Crea tu cuenta para solicitar el alquiler.",
      "/"
    );
    expect(baseProps.onContact).not.toHaveBeenCalled();
  });

  it("lets authenticated users use the rental calculator and contact the owner directly", async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProductInfo {...baseProps} isLoggedIn={true} />);

    expect(screen.getByTestId("rental-calculator")).toBeInTheDocument();
    expect(screen.getByText("80.00€")).toBeInTheDocument();
    expect(screen.getByText("Madrid, Comunidad de Madrid")).toBeInTheDocument();
    expect(screen.getByText(/El pago del alquiler y la fianza/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Contactar empresa" }));

    expect(baseProps.onContact).toHaveBeenCalledTimes(1);
    expect(openSignUpMock).not.toHaveBeenCalled();
  });

  it("shows the draft warning and the unavailable alert when the product cannot be rented now", () => {
    useProductRentabilityMock.mockReturnValue({
      availabilityTone: "warning",
      availabilityLabel: "Sin stock",
      availabilityMessage: "Ahora mismo no quedan huecos libres para nuevas reservas.",
      isRentableNow: false,
    });

    renderWithProviders(
      <ProductInfo
        {...baseProps}
        isLoggedIn={true}
        product={{
          ...baseProps.product,
          publicationStatus: "draft",
        }}
      />
    );

    expect(screen.getByText("Producto no publicado")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getAllByText("Sin stock")).toHaveLength(2);
    expect(
      screen.getByText("Ahora mismo no quedan huecos libres para nuevas reservas.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alquiler no disponible ahora" })).toBeDisabled();
  });

  it("renders the archived status label when the product is no longer published", () => {
    renderWithProviders(
      <ProductInfo
        {...baseProps}
        isLoggedIn={true}
        product={{
          ...baseProps.product,
          publicationStatus: "archived",
          price: {
            daily: 0,
            deposit: 0,
            tiers: [],
          },
        }}
      />
    );

    expect(screen.getByText("Producto no publicado")).toBeInTheDocument();
    expect(screen.getByText("Archivado")).toBeInTheDocument();
    expect(screen.queryByText("Fianza")).not.toBeInTheDocument();
    expect(screen.queryByText("Descuentos por duración")).not.toBeInTheDocument();
  });

  it("shows the first priced tier when earlier tiers still require consultation", () => {
    renderWithProviders(
      <ProductInfo
        {...baseProps}
        isLoggedIn={true}
        product={{
          ...baseProps.product,
          price: {
            daily: 0,
            deposit: 80,
            tiers: [
              {
                daysFrom: 1,
                daysTo: 3,
                pricePerDay: 0,
              },
              {
                daysFrom: 4,
                daysTo: 7,
                pricePerDay: 19.5,
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByText("Primera tarifa pública")).toBeInTheDocument();
    expect(screen.getByText("Disponible a partir de 4 días")).toBeInTheDocument();
    expect(screen.getAllByText("19.50€")).toHaveLength(2);
    expect(screen.getByText("/ día")).toBeInTheDocument();
  });
});
