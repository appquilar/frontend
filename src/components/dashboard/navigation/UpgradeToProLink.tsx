import { Gem } from "lucide-react";
import { toast } from "sonner";

import {
  useCreateCheckoutSession,
  useCreateCustomerPortalSession,
} from "@/application/hooks/useBilling";
import { useAuth } from "@/context/AuthContext";
import { getEffectiveUserPlan } from "@/domain/models/Subscription";
import {
  buildBillingBaseUrl,
  buildBillingCheckoutSuccessUrl,
  buildBillingPortalReturnUrl,
} from "@/hooks/useBillingReturnSync";
import {
  getUserProCheckoutErrorMessage,
  useUserProCheckout,
} from "@/hooks/useUserProCheckout";

interface UpgradeToProLinkProps {
  onAfterNavigate?: () => void;
}

const UpgradeToProLink = ({ onAfterNavigate }: UpgradeToProLinkProps) => {
  const { currentUser } = useAuth();
  const createCheckoutMutation = useCreateCheckoutSession();
  const createPortalMutation = useCreateCustomerPortalSession();
  const userProCheckout = useUserProCheckout();

  if (!currentUser) {
    return null;
  }

  const hasCompanyProfile = Boolean(
    currentUser.companyContext?.companyId ?? currentUser.companyId
  );
  const isUserPro = getEffectiveUserPlan(
    currentUser.planType,
    currentUser.subscriptionStatus
  ) === "user_pro";

  const companyContext = currentUser.companyContext ?? null;

  const handleCompanyUpgrade = async () => {
    if (!companyContext) {
      window.location.assign("/dashboard/upgrade");
      return;
    }

    const newTab = window.open("", "_blank");
    if (!newTab) {
      toast.error("No se pudo abrir una nueva pestaña. Revisa el bloqueador de ventanas emergentes.");
      return;
    }
    newTab.opener = null;

    try {
      const currentBaseUrl = buildBillingBaseUrl(window.location.href);
      const portalSession = await createPortalMutation.mutateAsync({
        scope: "company",
        returnUrl: buildBillingPortalReturnUrl(currentBaseUrl, "company", {
          planType: companyContext.planType,
          subscriptionStatus: companyContext.subscriptionStatus,
          subscriptionCancelAtPeriodEnd:
            companyContext.subscriptionCancelAtPeriodEnd,
        }),
      });
      onAfterNavigate?.();
      newTab.location.href = portalSession.url;
    } catch (error) {
      newTab.close();
      console.error("Error creating company portal session", error);
      toast.error("No se pudo abrir el Customer Portal de la empresa.");
    }
  };

  if (hasCompanyProfile || isUserPro) {
    const label = hasCompanyProfile
      ? companyContext?.planType === "enterprise"
        ? null
        : companyContext?.planType === "pro"
          ? "Hazte Enterprise"
          : "Hazte Pro"
      : "Hazte empresa";

    if (!label) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={() => void handleCompanyUpgrade()}
        disabled={createPortalMutation.isPending}
        className="w-full rounded-xl border border-[#F19D70]/30 bg-[#F19D70]/10 px-4 py-3 text-left transition-colors hover:bg-[#F19D70]/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#C86A35]">
              {createPortalMutation.isPending ? "Abriendo..." : label}
            </p>
            <p className="text-xs text-zinc-600">
              {hasCompanyProfile
                ? "Amplía los límites y capacidades de tu empresa."
                : "Crea tu perfil de empresa y publica como profesional."}
            </p>
          </div>
          <Gem size={16} className="mt-1 shrink-0 text-[#F19D70]" />
        </div>
      </button>
    );
  }

  const handleUpgradeToPro = async () => {
    const currentUrl = window.location.href;
    const currentBaseUrl = buildBillingBaseUrl(currentUrl);

    if (!userProCheckout.isCheckoutAvailable) {
      toast.error(
        userProCheckout.unavailableMessage ??
          "User Pro no está disponible para activar ahora mismo."
      );
      return;
    }

    try {
      const checkoutSession = await createCheckoutMutation.mutateAsync({
        scope: "user",
        planType: "user_pro",
        successUrl: buildBillingCheckoutSuccessUrl(currentBaseUrl, "user", "user_pro"),
        cancelUrl: currentBaseUrl,
      });

      onAfterNavigate?.();
      window.location.assign(checkoutSession.url);
    } catch (error) {
      console.error("Error creating user checkout session", error);
      toast.error(
        getUserProCheckoutErrorMessage(
          error,
          "No se pudo iniciar el checkout para el plan Pro."
        )
      );
    }
  };

  return (
    <button
      onClick={() => {
        void handleUpgradeToPro();
      }}
      disabled={createCheckoutMutation.isPending || userProCheckout.isLoading}
      className="w-full rounded-xl border border-[#F19D70]/30 bg-[#F19D70]/10 px-4 py-3 text-left transition-colors hover:bg-[#F19D70]/15 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#C86A35]">
            {createCheckoutMutation.isPending
              ? "Redirigiendo..."
              : userProCheckout.isLoading
                ? "Cargando plan..."
                : "Hazte Pro"}
          </p>
          <p className="text-xs text-zinc-600">
            Accede a métricas de visitas y mensajes por producto.
          </p>
        </div>
        <Gem size={16} className="mt-1 shrink-0 text-[#F19D70]" />
      </div>
    </button>
  );
};

export default UpgradeToProLink;
