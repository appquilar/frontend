import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CategorySelect from "@/components/dashboard/products/CategorySelect";

const useAllPlatformCategoriesMock = vi.fn();

vi.mock("@/application/hooks/useAllPlatformCategories", () => ({
  useAllPlatformCategories: () => useAllPlatformCategoriesMock(),
}));

describe("CategorySelect", () => {
  it("searches and selects categories from the combobox", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    useAllPlatformCategoriesMock.mockReturnValue({
      categories: [
        { id: "cat-1", name: "Cámping", slug: "camping", parentId: null },
        { id: "cat-2", name: "Herramientas", slug: "herramientas", parentId: null },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <CategorySelect
        value={null}
        onChange={onChange}
        placeholder="Seleccionar categoría del producto"
      />
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Buscar categoría..."), "camp");
    await user.click(screen.getByText("Cámping"));

    expect(onChange).toHaveBeenCalledWith("cat-1");
  });

  it("shows parent categories first and drills down into children", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    useAllPlatformCategoriesMock.mockReturnValue({
      categories: [
        { id: "cat-1", name: "Herramientas", slug: "herramientas", parentId: null },
        { id: "cat-2", name: "Taladros", slug: "taladros", parentId: "cat-1" },
        { id: "cat-3", name: "Vehículos", slug: "vehiculos", parentId: null },
      ],
      isLoading: false,
      error: null,
    });

    render(
      <CategorySelect
        value={null}
        onChange={onChange}
        placeholder="Seleccionar categoría del producto"
      />
    );

    await user.click(screen.getByRole("combobox"));

    expect(screen.getByText("Herramientas")).toBeVisible();
    expect(screen.getByText("Vehículos")).toBeVisible();
    expect(screen.queryByText("Taladros")).not.toBeInTheDocument();

    await user.click(screen.getByText("Herramientas"));

    expect(onChange).toHaveBeenLastCalledWith("cat-1");
    expect(screen.getByText("Taladros")).toBeVisible();

    await user.click(screen.getByText("Taladros"));

    expect(onChange).toHaveBeenLastCalledWith("cat-2");
  });
});
