import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

import { useAllPlatformCategories } from "@/application/hooks/useAllPlatformCategories";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Category } from "@/domain/models/Category";
import { buildCategoryBreadcrumbName } from "@/utils/categoryBreadcrumb";
import { normalizeSearchText } from "@/utils/normalizeSearchText";
import { cn } from "@/lib/utils";

type Props = {
    value: string | null;
    onChange: (categoryId: string | null) => void;
    onCategorySelect?: (category: Category | null) => void;
    disabled?: boolean;
    placeholder?: string;
    emptyLabel?: string;
    allowClear?: boolean;
    clearLabel?: string;
    showBreadcrumbs?: boolean;
};

export default function CategorySelect({
    value,
    onChange,
    onCategorySelect,
    disabled,
    placeholder = "Selecciona categoría…",
    emptyLabel = "No hay resultados",
    allowClear = false,
    clearLabel = "Sin categoría",
    showBreadcrumbs = true,
}: Props) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentParentId, setCurrentParentId] = useState<string | null>(null);
    const { categories, isLoading, error } = useAllPlatformCategories();

    const categoriesById = useMemo(() => {
        return new Map(categories.map((category) => [category.id, category]));
    }, [categories]);

    const childrenByParentId = useMemo(() => {
        const map = new Map<string | null, Category[]>();

        for (const category of categories) {
            const parentId = category.parentId && categoriesById.has(category.parentId)
                ? category.parentId
                : null;
            const children = map.get(parentId) ?? [];

            children.push(category);
            map.set(parentId, children);
        }

        for (const children of map.values()) {
            children.sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
        }

        return map;
    }, [categories, categoriesById]);

    const categoryOptions = useMemo(() => {
        return categories
            .map((category) => {
                const breadcrumb = buildCategoryBreadcrumbName(category, categoriesById);

                return {
                    category,
                    breadcrumb,
                    searchText: normalizeSearchText(`${category.name} ${category.slug} ${breadcrumb}`),
                };
            })
            .sort((left, right) => left.breadcrumb.localeCompare(right.breadcrumb, "es", { sensitivity: "base" }));
    }, [categories, categoriesById]);

    const optionsById = useMemo(() => {
        return new Map(categoryOptions.map((option) => [option.category.id, option]));
    }, [categoryOptions]);

    const selectedCategory = value ? categoriesById.get(value) ?? null : null;
    const currentParent = currentParentId ? categoriesById.get(currentParentId) ?? null : null;
    const normalizedSearchQuery = normalizeSearchText(searchQuery);

    const visibleOptions = useMemo(() => {
        if (normalizedSearchQuery) {
            return categoryOptions.filter((option) => option.searchText.includes(normalizedSearchQuery));
        }

        return (childrenByParentId.get(currentParentId) ?? [])
            .map((category) => optionsById.get(category.id))
            .filter(Boolean);
    }, [categoryOptions, childrenByParentId, currentParentId, normalizedSearchQuery, optionsById]);

    const handleSelect = (category: Category | null) => {
        onChange(category?.id ?? null);
        onCategorySelect?.(category);

        const hasChildren = category ? (childrenByParentId.get(category.id)?.length ?? 0) > 0 : false;

        if (category && hasChildren && !normalizedSearchQuery) {
            setCurrentParentId(category.id);
            return;
        }

        setOpen(false);
        setSearchQuery("");
        setCurrentParentId(null);
    };

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);

        if (!nextOpen) {
            setSearchQuery("");
            setCurrentParentId(null);
        }
    };

    const buttonLabel = (() => {
        if (selectedCategory) {
            return showBreadcrumbs
                ? buildCategoryBreadcrumbName(selectedCategory, categoriesById)
                : selectedCategory.name;
        }

        return isLoading ? "Cargando..." : error ?? (allowClear ? clearLabel : placeholder);
    })();

    const goBack = () => {
        setCurrentParentId(currentParent?.parentId && categoriesById.has(currentParent.parentId)
            ? currentParent.parentId
            : null);
    };

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "h-10 w-full justify-between px-3 font-normal",
                        !selectedCategory && "text-muted-foreground"
                    )}
                    disabled={disabled || isLoading || Boolean(error)}
                >
                    <span className="truncate text-left">{buttonLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
                align="start"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        value={searchQuery}
                        placeholder="Buscar categoría..."
                        onValueChange={setSearchQuery}
                    />
                    {!normalizedSearchQuery && currentParent ? (
                        <div className="border-b p-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start font-normal"
                                onClick={goBack}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                <span className="truncate">{currentParent.name}</span>
                            </Button>
                        </div>
                    ) : null}
                    <CommandList>
                        <CommandEmpty>{isLoading ? "Cargando..." : emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {allowClear ? (
                                <CommandItem onSelect={() => handleSelect(null)}>
                                    <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
                                    {clearLabel}
                                </CommandItem>
                            ) : null}
                            {visibleOptions.map((option) => {
                                const hasChildren = (childrenByParentId.get(option.category.id)?.length ?? 0) > 0;
                                const shouldShowBreadcrumb = showBreadcrumbs
                                    && Boolean(normalizedSearchQuery)
                                    && option.breadcrumb !== option.category.name;

                                return (
                                    <CommandItem
                                        key={option.category.id}
                                        value={option.category.id}
                                        onSelect={() => handleSelect(option.category)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                value === option.category.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">{option.category.name}</span>
                                            {shouldShowBreadcrumb ? (
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {option.breadcrumb}
                                                </span>
                                            ) : null}
                                        </div>
                                        {hasChildren && !normalizedSearchQuery ? (
                                            <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                        ) : null}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
