import { useMutation } from "@tanstack/react-query";
import { billingService } from "@/compositionRoot";
import type {
    MigrateCompanyToExplorerInput,
    CreateCompanyUpgradeCheckoutSessionInput,
    CreateCheckoutSessionInput,
    CreateCustomerPortalSessionInput,
    SynchronizeCheckoutSessionInput,
} from "@/domain/models/Billing";

export const useCreateCheckoutSession = () => {
    return useMutation({
        mutationFn: (input: CreateCheckoutSessionInput) =>
            billingService.createCheckoutSession(input),
    });
};

export const useCreateCompanyUpgradeCheckoutSession = () => {
    return useMutation({
        mutationFn: (input: CreateCompanyUpgradeCheckoutSessionInput) =>
            billingService.createCompanyUpgradeCheckoutSession(input),
    });
};

export const useCreateCustomerPortalSession = () => {
    return useMutation({
        mutationFn: (input: CreateCustomerPortalSessionInput) =>
            billingService.createCustomerPortalSession(input),
    });
};

export const useReactivateSubscription = () => {
    return useMutation({
        mutationFn: (input: { scope: "user" | "company" }) =>
            billingService.reactivateSubscription(input),
    });
};

export const useSynchronizeCheckoutSession = () => {
    return useMutation({
        mutationFn: (input: SynchronizeCheckoutSessionInput) =>
            billingService.synchronizeCheckoutSession(input),
    });
};

export const useMigrateCompanyToExplorer = () => {
    return useMutation({
        mutationFn: (input: MigrateCompanyToExplorerInput) =>
            billingService.migrateCompanyToExplorer(input),
    });
};
