import { useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardProducts, useDeleteProduct, usePublishProduct } from "@/application/hooks/useProducts";
import {
    DEFAULT_PRODUCT_PUBLICATION_STATUSES,
    type ProductFilters
} from "@/domain/repositories/ProductRepository";
import { useProductPublicationLimit } from "@/components/dashboard/products/hooks/useProductPublicationLimit";

type UseProductsManagementOptions = {
    initialPage?: number;
    perPage?: number;
};

export function useProductsManagement(options: UseProductsManagementOptions = {}) {
    const navigate = useNavigate();
    const { initialPage = 1, perPage = 10 } = options;

    const defaultFilters = useMemo<ProductFilters>(() => ({
        publicationStatus: [...DEFAULT_PRODUCT_PUBLICATION_STATUSES],
    }), []);
    const [filters, setFilters] = useState<ProductFilters>(defaultFilters);
    const [currentPage, setCurrentPage] = useState(initialPage);

    // Delete modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);
    const [productToDeleteName, setProductToDeleteName] = useState<string>("");

    const {
        ownerId,
        ownerType,
        isAuthLoading,
        publicationLimitCtaLabel,
        hasReachedProductPublicationLimit,
        handlePublicationLimitCta,
        isProcessingPublicationLimitCta,
    } = useProductPublicationLimit();

    // Debounce logic could be added here if needed, but for now passing filters directly
    const query = useDashboardProducts({
        page: currentPage,
        perPage,
        ownerId,
        ownerType,
        filters,
        enabled: !isAuthLoading,
    });
    const deleteProductMutation = useDeleteProduct();
    const publishProductMutation = usePublishProduct();

    const products = query.data?.data ?? [];
    const total = query.data?.total ?? 0;
    const errorMessage = query.error instanceof Error ? query.error.message : null;

    const totalPages = useMemo(() => {
        if (!perPage) return 1;
        return Math.max(1, Math.ceil(total / perPage));
    }, [total, perPage]);

    const handlePageChange = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);

    const handleFilterChange = useCallback((newFilters: ProductFilters) => {
        setFilters(newFilters);
        setCurrentPage(1); // Reset to first page on filter change
    }, []);

    // Helper for legacy SearchToolbar compatibility if needed
    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        // Triggered by form submit in toolbar, no-op if filters handled via onChange
    }, []);

    const handleEditProduct = useCallback(
        (productId: string) => {
            navigate(`/dashboard/products/${productId}`);
        },
        [navigate]
    );

    const openDeleteModal = useCallback((productId: string, productName: string) => {
        setProductToDeleteId(productId);
        setProductToDeleteName(productName);
        setIsDeleteModalOpen(true);
    }, []);

    const closeDeleteModal = useCallback(() => {
        setIsDeleteModalOpen(false);
        setProductToDeleteId(null);
        setProductToDeleteName("");
    }, []);

    const confirmDeleteProduct = useCallback(async () => {
        if (!productToDeleteId) return;
        await deleteProductMutation.mutateAsync(productToDeleteId);
        closeDeleteModal();
        await query.refetch();
    }, [productToDeleteId, closeDeleteModal, query, deleteProductMutation]);

    const handlePublishProduct = useCallback(async (productId: string) => {
        await publishProductMutation.mutateAsync(productId);
        await query.refetch();
    }, [publishProductMutation, query]);

    return {
        // Expose filters instead of simple searchQuery
        filters,
        handleFilterChange,

        // Compatibility props for existing UI if it wasn't fully updated yet
        searchQuery: filters.name || '',
        setSearchQuery: (val: string) => handleFilterChange({...filters, name: val}),

        filteredProducts: products, // Products are already filtered by server
        currentPage,
        totalPages,

        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: errorMessage,

        handlePageChange,
        handleSearch,
        handleEditProduct,
        handlePublishProduct,
        publicationLimitCtaLabel,
        hasReachedProductPublicationLimit,
        handlePublicationLimitCta,
        isProcessingPublicationLimitCta,

        isDeleteModalOpen,
        productToDeleteId,
        productToDeleteName,
        openDeleteModal,
        closeDeleteModal,
        confirmDeleteProduct,
        defaultFilters,
    };
}
