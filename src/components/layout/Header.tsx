import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, Plus, Search, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import AuthModal from "../auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUnreadRentMessagesTotal } from "@/application/hooks/useRentalMessages";

import AppLogo from "@/components/common/AppLogo";
import { usePublicSiteCategories } from "@/application/hooks/usePublicSiteCategories";
import { PUBLIC_PATHS, buildCategoryPath, buildSearchPath } from "@/domain/config/publicRoutes";
import { authModalReturnToStorageKey } from "@/hooks/useAuthModalLauncher";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

import { CategoryDrawerTree } from "@/components/layout/CategoryDrawerTree";
import PublicSessionMessagesLink from "@/components/layout/PublicSessionMessagesLink";

type DesktopCategoriesMode = "top" | "side";

// Keep both implementations available. "top" disables the side drawer in desktop.
const resolveDesktopCategoriesMode = (): DesktopCategoriesMode => "top";
const DESKTOP_CATEGORIES_MODE = resolveDesktopCategoriesMode();

const Header = () => {
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [desktopCategoriesOpen, setDesktopCategoriesOpen] = useState(false);
    const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
    const [mobileSessionOpen, setMobileSessionOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const headerRef = useRef<HTMLElement | null>(null);
    const desktopTopPanelRef = useRef<HTMLDivElement | null>(null);
    const desktopCategoriesTriggerRef = useRef<HTMLButtonElement | null>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, isAuthenticated, logout } = useAuth();
    const { totalUnread: unreadMessagesTotal } = useUnreadRentMessagesTotal({
        enabled: isAuthenticated && Boolean(currentUser),
    });

    const {
        menuCategories,     // 👉 SOLO navbar chips
        allCategories,
        isLoading: isSiteLoading,
    } = usePublicSiteCategories();

    const displayName =
        currentUser?.firstName
            ? `${currentUser.firstName} ${currentUser.lastName ?? ""}`.trim()
            : currentUser?.email ?? "Usuario";

    // Abrir login si venimos de reset password o de una ruta protegida
    useEffect(() => {
        if (isAuthenticated) return;
        const msg =
            sessionStorage.getItem("auth:infoMessage") ??
            sessionStorage.getItem("auth:postChangePasswordMessage") ??
            sessionStorage.getItem("auth:initialTab");
        if (msg) setAuthModalOpen(true);
    }, [isAuthenticated]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setSearchValue(params.get("q") ?? "");
    }, [location.search]);

    useEffect(() => {
        setDesktopCategoriesOpen(false);
        setMobileCategoriesOpen(false);
        setMobileSessionOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        if (DESKTOP_CATEGORIES_MODE !== "top" || !desktopCategoriesOpen) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (desktopTopPanelRef.current?.contains(target)) return;

            if (desktopCategoriesTriggerRef.current?.contains(target)) return;

            setDesktopCategoriesOpen(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setDesktopCategoriesOpen(false);
                requestAnimationFrame(() => desktopCategoriesTriggerRef.current?.focus());
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [desktopCategoriesOpen]);

    useEffect(() => {
        const headerElement = headerRef.current;
        if (!headerElement) return;

        const root = document.documentElement;

        const updateHeaderHeight = () => {
            const nextHeight = Math.ceil(headerElement.getBoundingClientRect().height);
            root.style.setProperty("--public-header-height", `${nextHeight}px`);
        };

        updateHeaderHeight();

        const resizeObserver = new ResizeObserver(() => {
            updateHeaderHeight();
        });

        resizeObserver.observe(headerElement);
        window.addEventListener("resize", updateHeaderHeight);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateHeaderHeight);
        };
    }, []);

    const handleLogout = async () => {
        await logout();
    };

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        const query = searchValue.trim();
        if (!query) {
            navigate(PUBLIC_PATHS.search);
            return;
        }

        navigate(buildSearchPath(query));
    };

    const handleSellClick = () => {
        if (!isAuthenticated) {
            sessionStorage.setItem(authModalReturnToStorageKey, "/dashboard/products/new");
            setAuthModalOpen(true);
            return;
        }

        navigate("/dashboard/products/new");
    };

    /**
     * ✅ CHIPS DEL NAVBAR
     * Usan EXCLUSIVAMENTE las categorías marcadas como
     * "Categorías del menú" en el Site (menuCategoryIds)
     */
    const menuTop = useMemo(() => {
        if (isSiteLoading) return [];
        return menuCategories.slice(0, 5); // máx 5 como en el admin
    }, [isSiteLoading, menuCategories]);

    /**
     * Drawer: árbol completo (sin fake fallback)
     */
    const drawerCategories = useMemo(() => {
        if (isSiteLoading) return [];
        return allCategories;
    }, [allCategories, isSiteLoading]);

    return (
        <>
            <header
                ref={headerRef}
                className="sticky top-0 left-0 right-0 z-50 border-b border-border/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90"
            >
                <div className="md:hidden">
                    <div className="mx-auto relative flex h-[70px] w-full max-w-[1320px] items-center px-4 sm:px-6">
                        <Sheet open={mobileCategoriesOpen} onOpenChange={setMobileCategoriesOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Abrir categorías"
                                    className="h-10 w-10 rounded-full"
                                >
                                    <Menu size={20} />
                                </Button>
                            </SheetTrigger>

                            <SheetContent
                                side="left"
                                className="p-0 w-[320px] flex flex-col"
                            >
                                <div className="sticky top-0 z-10 bg-background border-b p-6">
                                    <SheetHeader>
                                        <SheetTitle>Categorías</SheetTitle>
                                    </SheetHeader>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6">
                                    {drawerCategories.length === 0 ? (
                                        <div className="text-sm text-muted-foreground">
                                            Cargando categorías…
                                        </div>
                                    ) : (
                                        <CategoryDrawerTree
                                            categories={drawerCategories}
                                            isOpen={mobileCategoriesOpen}
                                            onNavigate={() => setMobileCategoriesOpen(false)}
                                        />
                                    )}
                                </div>
                            </SheetContent>
                        </Sheet>

                        <Link
                            to="/"
                            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center hover:opacity-90 transition-opacity"
                            aria-label="Ir a inicio"
                        >
                            <AppLogo
                                imageClassName="h-8 w-auto"
                                textClassName="text-[1.35rem] font-display font-semibold tracking-tight text-primary"
                            />
                        </Link>

                        <div className="ml-auto">
                            {isAuthenticated && currentUser ? (
                                <Sheet open={mobileSessionOpen} onOpenChange={setMobileSessionOpen}>
                                    <SheetTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            aria-label="Abrir menú de usuario"
                                            className="h-10 w-10 rounded-full border-border/80 text-foreground"
                                        >
                                            <User size={16} />
                                        </Button>
                                    </SheetTrigger>

                                    <SheetContent
                                        side="right"
                                        className="w-full max-w-full p-0 sm:max-w-full"
                                    >
                                        <div className="flex h-full flex-col">
                                            <div className="border-b border-border/70 px-6 py-6 pr-12">
                                                <p className="text-sm text-muted-foreground">Sesión</p>
                                                <p className="mt-1 text-lg font-semibold text-foreground">Hola, {displayName}</p>
                                            </div>

                                            <div className="flex-1 space-y-3 p-6">
                                                <Link
                                                    to="/dashboard"
                                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-white text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                                                    onClick={() => setMobileSessionOpen(false)}
                                                >
                                                    <LayoutDashboard size={16} />
                                                    Ir al dashboard
                                                </Link>

                                                <PublicSessionMessagesLink
                                                    mobile
                                                    onNavigate={() => setMobileSessionOpen(false)}
                                                    unreadCount={unreadMessagesTotal}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setMobileSessionOpen(false);
                                                        await handleLogout();
                                                    }}
                                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                                                >
                                                    <LogOut size={16} />
                                                    Cerrar sesión
                                                </button>
                                            </div>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    data-trigger-login
                                    onClick={() => setAuthModalOpen(true)}
                                    className="h-10 w-10 rounded-full border-primary/60 text-foreground"
                                    aria-label="Iniciar sesión"
                                >
                                    <User size={16} />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mx-auto hidden h-[70px] w-full max-w-[1320px] items-center gap-3 px-4 sm:px-6 md:flex md:px-8">
                    <Link
                        to="/"
                        className="flex items-center hover:opacity-90 transition-opacity shrink-0"
                        aria-label="Ir a inicio"
                    >
                        <AppLogo
                            imageClassName="h-7 w-auto"
                            textClassName="text-xl font-display font-semibold tracking-tight text-primary"
                        />
                    </Link>

                    <form onSubmit={handleSearchSubmit} className="flex min-w-0 flex-1 max-w-3xl">
                        <div className="relative w-full">
                            <Search
                                size={18}
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        handleSearchSubmit(event);
                                    }
                                }}
                                aria-label="Buscar productos"
                                placeholder="Busca productos para alquilar"
                                className="h-11 w-full rounded-full border border-border/80 bg-background pl-11 pr-4 text-sm text-foreground transition-colors focus:border-primary/50 focus:outline-none"
                            />
                        </div>
                    </form>

                    <div className="ml-auto flex items-center gap-3">
                        {isAuthenticated && currentUser ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-10 rounded-full border-border/80 px-4 text-sm"
                                    >
                                        <User size={16} />
                                        <span className="hidden lg:inline ml-2">Hola {displayName}</span>
                                    </Button>
                                </PopoverTrigger>

                                <PopoverContent className="p-0 w-56" align="end">
                                    <div className="p-3 border-b">
                                        <p className="font-medium">¡Hola, {displayName}!</p>
                                    </div>

                                    <div className="p-1">
                                        <Link
                                            to="/dashboard"
                                            className="flex items-center gap-2 p-2 hover:bg-secondary rounded-md text-sm"
                                        >
                                            <LayoutDashboard size={16} />
                                            Panel de control
                                        </Link>

                                        <PublicSessionMessagesLink unreadCount={unreadMessagesTotal} />

                                        <button
                                            onClick={handleLogout}
                                            className="flex items-center gap-2 p-2 hover:bg-secondary rounded-md w-full text-left text-destructive text-sm"
                                        >
                                            <LogOut size={16} />
                                            Cerrar sesión
                                        </button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <Button
                                ref={desktopCategoriesTriggerRef}
                                type="button"
                                variant="outline"
                                size="sm"
                                data-trigger-login
                                onClick={() => setAuthModalOpen(true)}
                                className="h-10 rounded-full border-primary/70 px-5 text-sm text-foreground hover:bg-primary/5"
                            >
                                Regístrate o inicia sesión
                            </Button>
                        )}

                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSellClick}
                            className="h-10 gap-2 rounded-full px-5 text-sm"
                        >
                            <Plus size={16} aria-hidden="true" />
                            Añadir producto
                        </Button>
                    </div>
                </div>

                <div className="hidden md:block border-t border-border/60">
                    <div className="mx-auto flex h-12 w-full max-w-[1320px] items-center gap-2 overflow-x-auto px-4 sm:px-6 md:px-8 [&::-webkit-scrollbar]:hidden">
                        {DESKTOP_CATEGORIES_MODE === "side" ? (
                            <Sheet open={desktopCategoriesOpen} onOpenChange={setDesktopCategoriesOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 h-9 gap-2 rounded-full px-4 text-sm text-foreground hover:bg-secondary"
                                    >
                                        <Menu size={16} />
                                        Todas las categorías
                                    </Button>
                                </SheetTrigger>

                                <SheetContent
                                    side="left"
                                    className="p-0 w-[360px] sm:w-[420px] flex flex-col"
                                >
                                    <div className="sticky top-0 z-10 bg-background border-b p-6">
                                        <SheetHeader className="space-y-1">
                                            <SheetTitle>Categorías</SheetTitle>
                                            <p className="text-sm text-muted-foreground">
                                                Explora el catálogo por familia
                                            </p>
                                        </SheetHeader>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6">
                                        {drawerCategories.length === 0 ? (
                                            <div className="text-sm text-muted-foreground">
                                                Cargando categorías…
                                            </div>
                                        ) : (
                                            <CategoryDrawerTree
                                                categories={drawerCategories}
                                                isOpen={desktopCategoriesOpen}
                                                onNavigate={() => setDesktopCategoriesOpen(false)}
                                            />
                                        )}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        ) : (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-desktop-categories-trigger
                                onClick={() => setDesktopCategoriesOpen((prev) => !prev)}
                                className="shrink-0 h-9 gap-2 rounded-full px-4 text-sm text-foreground hover:bg-secondary"
                            >
                                <Menu size={16} />
                                Todas las categorías
                            </Button>
                        )}

                        <nav className="flex items-center gap-1">
                            {menuTop.map((category) => (
                                <Link
                                    key={category.id}
                                    to={buildCategoryPath(category.slug)}
                                    className="shrink-0 rounded-full px-4 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-secondary hover:text-foreground"
                                >
                                    {category.name}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                {DESKTOP_CATEGORIES_MODE === "top" && desktopCategoriesOpen ? (
                    <div className="hidden md:block border-t border-b border-border/60 bg-white">
                        <div
                            ref={desktopTopPanelRef}
                            className="max-h-[68vh] w-full overflow-y-auto px-4 py-5 sm:px-6 md:px-8"
                        >
                            <div className="mx-auto w-full max-w-[1320px]">
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-foreground">Categorías</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Explora el catálogo por familia
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setDesktopCategoriesOpen(false);
                                            requestAnimationFrame(() => desktopCategoriesTriggerRef.current?.focus());
                                        }}
                                        className="h-8 gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        <X size={14} />
                                        Cerrar
                                    </Button>
                                </div>

                                {drawerCategories.length === 0 ? (
                                    <div className="text-sm text-muted-foreground">Cargando categorías…</div>
                                ) : (
                                    <CategoryDrawerTree
                                        categories={drawerCategories}
                                        isOpen={desktopCategoriesOpen}
                                        onNavigate={() => setDesktopCategoriesOpen(false)}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}
            </header>

            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
            />
        </>
    );
};

export default Header;
