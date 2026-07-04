const AUTH_MODAL_INITIAL_TAB_KEY = "auth:initialTab";
const AUTH_MODAL_RETURN_TO_KEY = "auth:returnTo";

type AuthModalTab = "signin" | "signup";

const triggerAuthModal = (tab: AuthModalTab, infoMessage?: string, returnTo?: string) => {
    sessionStorage.setItem(AUTH_MODAL_INITIAL_TAB_KEY, tab);

    if (infoMessage) {
        sessionStorage.setItem("auth:infoMessage", infoMessage);
    }

    if (returnTo) {
        sessionStorage.setItem(AUTH_MODAL_RETURN_TO_KEY, returnTo);
    }

    const trigger = document.querySelector("[data-trigger-login]") as HTMLElement | null;
    trigger?.click();
};

export const useAuthModalLauncher = () => {
    return {
        openSignIn: (infoMessage?: string, returnTo?: string) => triggerAuthModal("signin", infoMessage, returnTo),
        openSignUp: (infoMessage?: string, returnTo?: string) => triggerAuthModal("signup", infoMessage, returnTo),
    };
};

export const authModalReturnToStorageKey = AUTH_MODAL_RETURN_TO_KEY;
