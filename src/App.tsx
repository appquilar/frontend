import { Suspense, lazy, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import { queryClient } from "@/composition/queryClient";
import { useRouteCurrentUserRefresh } from "@/hooks/useRouteCurrentUserRefresh";
import { MailpitFloatingButton } from "@/components/dev/MailpitFloatingButton";
import {
    LEGACY_PUBLIC_PATHS,
    PUBLIC_PATHS,
    buildCompanyPath,
    buildCategoryPath,
    buildProductPath,
} from "@/domain/config/publicRoutes";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const ContactPage = lazy(() => import("@/pages/ContactPage"));
const PartnersPage = lazy(() => import("@/pages/PartnersPage"));
const BlogPage = lazy(() => import("@/pages/BlogPage"));
const BlogPostPage = lazy(() => import("@/pages/BlogPostPage"));
const PublicCompanyPage = lazy(() => import("@/pages/PublicCompanyPage"));
const CompanyInvitationPage = lazy(() => import("@/pages/CompanyInvitationPage"));
const LegalNoticePage = lazy(() => import("@/pages/legal/LegalNoticePage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const CookiesPage = lazy(() => import("@/pages/legal/CookiesPage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));

const RedirectTo = ({ to }: { to: string }) => <Navigate to={to} replace />;

const RouteFallback = () => (
    <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
    </div>
);

const withRouteSuspense = (element: ReactNode) => (
    <Suspense fallback={<RouteFallback />}>
        {element}
    </Suspense>
);

const AppRouteEffects = () => {
    useRouteCurrentUserRefresh();

    return null;
};

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <MailpitFloatingButton />

            {/* 🔒 ÚNICO AuthProvider global */}
            <AuthProvider>
                <BrowserRouter>
                    <AppRouteEffects />
                    <Routes>
                        <Route path="/" element={withRouteSuspense(<Index />)} />
                        <Route path={PUBLIC_PATHS.categories} element={withRouteSuspense(<CategoriesPage />)} />
                        <Route path={PUBLIC_PATHS.search} element={withRouteSuspense(<SearchPage />)} />
                        <Route path="/producto/:slug" element={withRouteSuspense(<ProductDetail />)} />
                        <Route path="/categoria/:slug" element={withRouteSuspense(<CategoryPage />)} />
                        <Route path={`${PUBLIC_PATHS.company}/:slug`} element={withRouteSuspense(<PublicCompanyPage />)} />

                        {/* Info */}
                        <Route path={PUBLIC_PATHS.about} element={withRouteSuspense(<AboutPage />)} />
                        <Route path={PUBLIC_PATHS.contact} element={withRouteSuspense(<ContactPage />)} />
                        <Route path={PUBLIC_PATHS.partners} element={withRouteSuspense(<PartnersPage />)} />
                        <Route path={PUBLIC_PATHS.blog} element={withRouteSuspense(<BlogPage />)} />
                        <Route path={`${PUBLIC_PATHS.blog}/*`} element={withRouteSuspense(<BlogPostPage />)} />

                        {/* English compatibility aliases */}
                        <Route path={LEGACY_PUBLIC_PATHS.categories} element={<RedirectTo to={PUBLIC_PATHS.categories} />} />
                        <Route path={LEGACY_PUBLIC_PATHS.search} element={<RedirectTo to={PUBLIC_PATHS.search} />} />
                        <Route
                            path={LEGACY_PUBLIC_PATHS.company}
                            element={<RouteAliasRedirect buildTarget={(slug) => buildCompanyPath(slug)} />}
                        />
                        <Route
                            path="/product/:slug"
                            element={<RouteAliasRedirect buildTarget={(slug) => buildProductPath(slug)} />}
                        />
                        <Route
                            path="/category/:slug"
                            element={<RouteAliasRedirect buildTarget={(slug) => buildCategoryPath(slug)} />}
                        />
                        <Route path={LEGACY_PUBLIC_PATHS.about} element={<RedirectTo to={PUBLIC_PATHS.about} />} />
                        <Route path={LEGACY_PUBLIC_PATHS.contact} element={<RedirectTo to={PUBLIC_PATHS.contact} />} />
                        <Route path={LEGACY_PUBLIC_PATHS.partners} element={<RedirectTo to={PUBLIC_PATHS.partners} />} />

                        {/* Legales */}
                        <Route path="/legal/aviso-legal" element={withRouteSuspense(<LegalNoticePage />)} />
                        <Route path="/legal/terminos" element={withRouteSuspense(<TermsPage />)} />
                        <Route path="/legal/cookies" element={withRouteSuspense(<CookiesPage />)} />
                        <Route path="/legal/privacidad" element={withRouteSuspense(<PrivacyPage />)} />

                        {/* Ruta de reset de contraseña */}
                        <Route path="/reset-password" element={withRouteSuspense(<ResetPassword />)} />
                        <Route path="/company-invitation" element={withRouteSuspense(<CompanyInvitationPage />)} />

                        {/* 🔐 Dashboard protegido */}
                        <Route
                            path="/dashboard/*"
                            element={
                                <ProtectedRoute>
                                    {withRouteSuspense(<Dashboard />)}
                                </ProtectedRoute>
                            }
                        />

                        {/* Catch-all */}
                        <Route path="*" element={withRouteSuspense(<NotFound />)} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </TooltipProvider>
    </QueryClientProvider>
);

function RouteAliasRedirect({ buildTarget }: { buildTarget: (slug: string) => string }) {
    const { slug = "" } = useParams<{ slug: string }>();
    const location = useLocation();
    const search = location.search;
    return <Navigate to={`${buildTarget(slug)}${search}`} replace />;
}

export default App;
