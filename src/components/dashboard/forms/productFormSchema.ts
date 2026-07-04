import { z } from 'zod';
import { Product } from '@/domain/models/Product';

const productImageSchema = z.object({
    id: z.string(),
    url: z.string().optional(),
    file: z.instanceof(File).optional(),
});

const normalizeDecimalInput = (value: string) => value.replace(',', '.').trim();

const optionalNonNegativeNumberSchema = (message: string) =>
    z.union([z.string(), z.number(), z.undefined()]).transform((value, ctx) => {
        if (value === undefined) {
            return undefined;
        }

        if (typeof value === 'number') {
            if (Number.isFinite(value) && value >= 0) {
                return value;
            }

            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message,
            });

            return z.NEVER;
        }

        const normalized = normalizeDecimalInput(value);

        if (normalized === '') {
            return undefined;
        }

        const parsedValue = Number(normalized);

        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message,
            });

            return z.NEVER;
        }

        return parsedValue;
    });

const draftNonNegativeNumberSchema = (invalidMessage: string) =>
    z.union([z.string(), z.number(), z.undefined()]).transform((value, ctx) => {
        if (value === undefined) {
            return 0;
        }

        if (typeof value === 'number') {
            if (Number.isFinite(value) && value >= 0) {
                return value;
            }

            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: invalidMessage,
            });

            return z.NEVER;
        }

        const normalized = normalizeDecimalInput(value);

        if (normalized === '') {
            return 0;
        }

        const parsedValue = Number(normalized);

        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: invalidMessage,
            });

            return z.NEVER;
        }

        return parsedValue;
    });

export const productFormSchema = z.object({
    internalId: z.string().optional(),
    name: z.string().default(''),
    slug: z.string().default(''),
    description: z.string().default(''),
    imageUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    publicationStatus: z.enum(['draft', 'published', 'archived']).default('draft'),
    quantity: z.coerce.number().int().min(1, { message: 'La capacidad debe ser al menos 1' }).default(1),
    isRentalEnabled: z.boolean().default(true),
    isInventoryEnabled: z.boolean().default(false),
    inventoryMode: z.enum(['unmanaged', 'managed_serialized']).default('unmanaged'),

    price: z.object({
        daily: z.coerce.number().default(0),
        deposit: optionalNonNegativeNumberSchema('La fianza debe ser mayor o igual a 0'),
        tiers: z.array(z.object({
            daysFrom: z.coerce.number().min(1, { message: 'Debe ser al menos 1' }),
            daysTo: z.coerce.number().nullable().optional(),
            pricePerDay: draftNonNegativeNumberSchema('El precio debe ser mayor o igual a 0'),
        })).default([]),
    }),
    secondHand: z.object({
        price: z.coerce.number().optional(),
        negotiable: z.boolean().optional(),
        additionalInfo: z.string().optional(),
    }).optional(),
    isRentable: z.boolean().optional(),
    isForSale: z.boolean().optional(),
    productType: z.enum(['rental', 'sale']),
    category: z.object({
        id: z.string().nullable().optional(),
        name: z.string().optional(),
        slug: z.string().optional(),
    }),
    currentTab: z.string().optional(),
    images: z.array(productImageSchema).default([]),
    dynamicProperties: z.record(z.string(), z.unknown()).default({}),
}).superRefine((values, ctx) => {
    if (values.publicationStatus !== 'published') {
        return;
    }

    if (values.name.trim().length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['name'],
            message: 'El nombre es obligatorio para publicar',
        });
    }

    if (values.slug.trim().length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['slug'],
            message: 'El slug es obligatorio para publicar',
        });
    }

    if (values.description.trim().length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['description'],
            message: 'La descripción es obligatoria para publicar',
        });
    }

    if (!values.category.id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['category', 'id'],
            message: 'La categoría es obligatoria para publicar',
        });
    }

    if (values.images.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['images'],
            message: 'Añade al menos una imagen para publicar',
        });
    }

    const firstPositivePriceIndex = values.price.tiers.findIndex(
        (tier) => Number(tier.pricePerDay) > 0
    );

    if (firstPositivePriceIndex === -1) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['price', 'tiers', 0, 'pricePerDay'],
            message: 'Añade un precio diario mayor que 0 para publicar',
        });
    }
});

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormSubmitValues = z.output<typeof productFormSchema>;
export type ProductFormImage = z.infer<typeof productImageSchema>;

export const createEmptyPriceTier = (): ProductFormValues['price']['tiers'][number] => ({
    daysFrom: 1,
    daysTo: undefined,
    pricePerDay: '',
});

export const mapProductToFormValues = (product: Product): ProductFormValues => {
    let initialImages: ProductFormImage[] = [];
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    if (product.image_ids && Array.isArray(product.image_ids)) {
        initialImages = product.image_ids.map((id: string) => ({
            id: id,
            url: `${baseUrl}/api/media/images/${id}/MEDIUM`,
            // 'file' no es necesario para imágenes existentes
        }));
    } else if (product.imageUrl) {
        initialImages.push({
            id: 'main',
            url: product.imageUrl
        });
    }

    return {
        internalId: product.internalId || '',
        name: product.name || '',
        slug: product.slug || '',
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        thumbnailUrl: product.thumbnailUrl || '',
        publicationStatus: product.publicationStatus || 'draft',
        quantity: product.inventorySummary?.totalQuantity ?? product.quantity ?? 1,
        isRentalEnabled: true,
        isInventoryEnabled: product.inventorySummary?.isInventoryEnabled ?? product.isInventoryEnabled ?? true,
        inventoryMode: product.inventorySummary?.inventoryMode
            ?? product.inventoryMode
            ?? ((product.inventorySummary?.isInventoryEnabled ?? product.isInventoryEnabled) ? 'managed_serialized' : 'unmanaged'),
        price: {
            daily: product.price?.daily || 0,
            deposit: product.price?.deposit,
            tiers: product.price?.tiers?.map(tier => ({
                daysFrom: tier.daysFrom,
                daysTo: tier.daysTo,
                pricePerDay: tier.pricePerDay
            })) || [],
        },
        secondHand: undefined,
        isRentable: true,
        isForSale: false,
        productType: 'rental',
        category: {
            id: product.category?.id || null,
            name: product.category?.name || '',
            slug: product.category?.slug || '',
        },
        images: initialImages,
        dynamicProperties: product.dynamicProperties ?? {},
    };
};

export const mapFormValuesToProduct = (values: ProductFormSubmitValues, originalProduct: Product): Partial<Product> => {
    const category = values.category.id ? {
        id: values.category.id,
        name: values.category.name || '',
        slug: values.category.slug || '',
    } : originalProduct.category;

    return {
        ...originalProduct,
        internalId: values.internalId,
        name: values.name,
        slug: values.slug,
        description: values.description,
        imageUrl: values.imageUrl,
        thumbnailUrl: values.thumbnailUrl,
        publicationStatus: values.publicationStatus,
        quantity: values.quantity,
        isRentalEnabled: true,
        isInventoryEnabled: values.inventoryMode !== 'unmanaged',
        inventoryMode: values.inventoryMode,
        price: {
            daily: values.price.daily || 0,
            deposit: values.price.deposit,
            tiers: values.price.tiers.map(tier => ({
                daysFrom: tier.daysFrom,
                daysTo: tier.daysTo || undefined,
                pricePerDay: tier.pricePerDay
            })),
        },
        productType: 'rental',
        category,
        dynamicProperties: (values.dynamicProperties ?? {}) as Product["dynamicProperties"],
    };
};
