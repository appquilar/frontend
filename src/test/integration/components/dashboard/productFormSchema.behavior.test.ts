import { describe, expect, it } from "vitest";

import type { Product } from "@/domain/models/Product";
import {
  createEmptyPriceTier,
  mapFormValuesToProduct,
  mapProductToFormValues,
  productFormSchema,
} from "@/components/dashboard/forms/productFormSchema";

const createProduct = (): Product => ({
  id: "product-1",
  internalId: "SKU-1",
  name: "Taladro",
  slug: "taladro",
  description: "Taladro profesional",
  quantity: 3,
  isRentalEnabled: true,
  isInventoryEnabled: false,
  inventoryMode: "unmanaged",
  imageUrl: "https://cdn.example.com/taladro.jpg",
  thumbnailUrl: "https://cdn.example.com/taladro-thumb.jpg",
  publicationStatus: "published",
  price: {
    daily: 25,
    deposit: 80,
    tiers: [
      {
        daysFrom: 1,
        daysTo: 3,
        pricePerDay: 25,
      },
    ],
  },
  category: {
    id: "cat-1",
    name: "Herramientas",
    slug: "herramientas",
  },
  rating: 4.5,
  reviewCount: 12,
  productType: "rental",
  dynamicProperties: {},
});

describe("productFormSchema", () => {
  it("parses coercible values, comma decimals and blank optional deposit fields", () => {
    const parsed = productFormSchema.parse({
      internalId: "SKU-1",
      name: "Taladro",
      slug: "taladro",
      description: "Taladro profesional",
      publicationStatus: "draft",
      quantity: "2",
      isRentalEnabled: true,
      isInventoryEnabled: false,
      inventoryMode: "unmanaged",
      price: {
        daily: 0,
        deposit: "",
        tiers: [
          {
            daysFrom: "1",
            daysTo: "3",
            pricePerDay: "19,95",
          },
        ],
      },
      productType: "rental",
      category: {
        id: "cat-1",
        name: "Herramientas",
        slug: "herramientas",
      },
      images: [],
      dynamicProperties: {},
    });

    expect(parsed.quantity).toBe(2);
    expect(parsed.price.deposit).toBeUndefined();
    expect(parsed.price.tiers[0]).toMatchObject({
      daysFrom: 1,
      daysTo: 3,
      pricePerDay: 19.95,
    });
  });

  it("rejects negative pricing values and missing tier prices", () => {
    const result = productFormSchema.safeParse({
      internalId: "SKU-1",
      name: "Taladro",
      slug: "taladro",
      description: "Taladro profesional",
      publicationStatus: "draft",
      quantity: 1,
      isRentalEnabled: true,
      isInventoryEnabled: false,
      inventoryMode: "unmanaged",
      price: {
        daily: 0,
        deposit: "-1",
        tiers: [
          {
            daysFrom: 1,
            pricePerDay: "",
          },
        ],
      },
      productType: "rental",
      category: {
        id: "cat-1",
        name: "Herramientas",
        slug: "herramientas",
      },
      images: [],
      dynamicProperties: {},
    });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.price?.join(" ")).toContain(
      "La fianza debe ser mayor o igual a 0"
    );
    expect(result.error?.issues.some((issue) => issue.message === "Precio obligatorio")).toBe(true);
  });

  it("maps image ids and inventory defaults from product data into the form view model", () => {
    const product: Product = {
      ...createProduct(),
      image_ids: ["img-1", "img-2"],
      imageUrl: "",
      inventorySummary: {
        productId: "product-1",
        totalQuantity: 9,
        reservedQuantity: 1,
        availableQuantity: 8,
        isRentalEnabled: true,
        isInventoryEnabled: true,
        capabilityState: "enabled",
        inventoryMode: "managed_serialized",
        isRentableNow: true,
        unavailabilityReason: null,
        productInternalId: "SKU-1",
      },
    };

    const mapped = mapProductToFormValues(product);

    expect(mapped.quantity).toBe(9);
    expect(mapped.inventoryMode).toBe("managed_serialized");
    expect(mapped.images).toEqual([
      {
        id: "img-1",
        url: "http://localhost:8000/api/media/images/img-1/MEDIUM",
      },
      {
        id: "img-2",
        url: "http://localhost:8000/api/media/images/img-2/MEDIUM",
      },
    ]);
  });

  it("maps form values back to a product payload and preserves the original category when needed", () => {
    const originalProduct = createProduct();

    const payload = mapFormValuesToProduct(
      {
        internalId: "SKU-2",
        name: "Taladro nuevo",
        slug: "taladro-nuevo",
        description: "Nuevo copy",
        imageUrl: "",
        thumbnailUrl: "",
        publicationStatus: "archived",
        quantity: 4,
        isRentalEnabled: true,
        isInventoryEnabled: true,
        inventoryMode: "managed_serialized",
        price: {
          daily: 15,
          deposit: undefined,
          tiers: [
            {
              daysFrom: 1,
              daysTo: null,
              pricePerDay: 15,
            },
          ],
        },
        secondHand: undefined,
        isRentable: true,
        isForSale: false,
        productType: "rental",
        category: {
          id: null,
          name: "",
          slug: "",
        },
        currentTab: "general",
        images: [],
        dynamicProperties: {
          color: "naranja",
        },
      },
      originalProduct
    );

    expect(payload).toMatchObject({
      internalId: "SKU-2",
      name: "Taladro nuevo",
      slug: "taladro-nuevo",
      publicationStatus: "archived",
      quantity: 4,
      isInventoryEnabled: true,
      inventoryMode: "managed_serialized",
      category: originalProduct.category,
      dynamicProperties: {
        color: "naranja",
      },
    });
    expect(payload.price?.deposit).toBeUndefined();
    expect(payload.price?.tiers).toEqual([
      {
        daysFrom: 1,
        daysTo: undefined,
        pricePerDay: 15,
      },
    ]);
  });

  it("creates an empty first price tier for draft products", () => {
    expect(createEmptyPriceTier()).toEqual({
      daysFrom: 1,
      daysTo: undefined,
      pricePerDay: "",
    });
  });
});
