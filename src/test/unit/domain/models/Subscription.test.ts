import { describe, expect, it } from "vitest";

import type {
  CompanyContext,
  InventoryManagementCapability,
  UserSubscriptionContext,
} from "@/domain/models/Subscription";
import {
  canManageInventoryCapability,
  getCompanyCapability,
  getCompanyPlanProductLimit,
  getEffectiveUserPlan,
  getUserCapability,
  getUserPlanProductLimit,
  hasCompanyCapabilityAccess,
  hasInventoryReadAccess,
  hasUserCapabilityAccess,
  isCompanyAdvancedAnalyticsEnabled,
  isCompanyPremiumAdvancedStatsEnabled,
  isSubscriptionActive,
  isUserBasicAnalyticsEnabled,
} from "@/domain/models/Subscription";

const createCompanyContext = (overrides: Partial<CompanyContext> = {}): CompanyContext => ({
  companyId: "company-1",
  companyName: "Acme Rentals",
  companyRole: "ROLE_ADMIN",
  isCompanyOwner: true,
  planType: "pro",
  subscriptionStatus: "active",
  isFoundingAccount: false,
  productSlotLimit: 10,
  capabilities: {},
  entitlements: null,
  ...overrides,
});

const createUserContext = (
  overrides: Partial<UserSubscriptionContext> = {}
): UserSubscriptionContext => ({
  planType: "user_pro",
  subscriptionStatus: "active",
  capabilities: {},
  entitlements: null,
  ...overrides,
});

describe("subscription capability helpers", () => {
  it("recognizes active subscriptions and resolves user plan limits from fallbacks or entitlements", () => {
    expect(isSubscriptionActive("active")).toBe(true);
    expect(isSubscriptionActive("paused")).toBe(false);
    expect(isSubscriptionActive(undefined)).toBe(false);

    expect(getEffectiveUserPlan("user_pro", "active")).toBe("user_pro");
    expect(getEffectiveUserPlan("user_pro", "paused")).toBe("explorer");
    expect(getEffectiveUserPlan(null, "active")).toBe("explorer");

    expect(getUserPlanProductLimit("user_pro", "active")).toBe(5);
    expect(getUserPlanProductLimit("user_pro", "paused")).toBe(2);
    expect(
      getUserPlanProductLimit(undefined, undefined, {
        planType: "user_pro",
        subscriptionStatus: "active",
        quotas: {
          activeProducts: null,
          teamMembers: null,
        },
        capabilities: {},
        overrides: {
          isPlatformAdmin: false,
          isCompanyOwner: false,
          isCompanyAdmin: false,
          isFoundingAccount: false,
        },
      })
    ).toBeNull();
  });

  it("computes company product limits from entitlements, founding flags and effective plans", () => {
    expect(getCompanyPlanProductLimit(null)).toBeNull();

    expect(
      getCompanyPlanProductLimit(
        createCompanyContext({
          entitlements: {
            planType: "pro",
            subscriptionStatus: "active",
            quotas: {
              activeProducts: 22,
              teamMembers: 4,
            },
            capabilities: {},
            overrides: {
              isPlatformAdmin: false,
              isCompanyOwner: true,
              isCompanyAdmin: true,
              isFoundingAccount: false,
            },
          },
        })
      )
    ).toBe(22);

    expect(
      getCompanyPlanProductLimit(
        createCompanyContext({
          isFoundingAccount: true,
          entitlements: null,
        })
      )
    ).toBeNull();

    expect(
      getCompanyPlanProductLimit(
        createCompanyContext({
          planType: "pro",
          subscriptionStatus: "paused",
          entitlements: null,
        })
      )
    ).toBe(10);

    expect(
      getCompanyPlanProductLimit(
        createCompanyContext({
          planType: "enterprise",
          subscriptionStatus: "active",
          entitlements: null,
        })
      )
    ).toBeNull();
  });

  it("prefers entitlement capabilities over legacy company capabilities and supports allowed state overrides", () => {
    const context = createCompanyContext({
      capabilities: {
        advancedAnalytics: { state: "enabled", limits: null },
      },
      entitlements: {
        planType: "pro",
        subscriptionStatus: "active",
        quotas: {
          activeProducts: 10,
          teamMembers: null,
        },
        capabilities: {
          advancedAnalytics: { state: "disabled", limits: null },
          apiAccess: { state: "read_only", limits: null },
        },
        overrides: {
          isPlatformAdmin: false,
          isCompanyOwner: true,
          isCompanyAdmin: true,
          isFoundingAccount: false,
        },
      },
    });

    expect(getCompanyCapability(context, "advancedAnalytics")?.state).toBe("disabled");
    expect(hasCompanyCapabilityAccess(context, "advancedAnalytics")).toBe(false);
    expect(isCompanyAdvancedAnalyticsEnabled(context)).toBe(false);
    expect(hasCompanyCapabilityAccess(context, "apiAccess", ["enabled"])).toBe(false);
    expect(isCompanyPremiumAdvancedStatsEnabled(context)).toBe(true);
    expect(isCompanyPremiumAdvancedStatsEnabled(context, true)).toBe(true);
    expect(isCompanyPremiumAdvancedStatsEnabled(null)).toBe(false);
  });

  it("enables advanced dashboard capabilities for active early bird companies even with stale capabilities", () => {
    const context = createCompanyContext({
      planType: "early_bird",
      subscriptionStatus: "active",
      isFoundingAccount: true,
      capabilities: {
        advancedAnalytics: { state: "disabled", limits: null },
        apiAccess: { state: "disabled", limits: null },
      },
      entitlements: {
        planType: "early_bird",
        subscriptionStatus: "active",
        quotas: {
          activeProducts: null,
          teamMembers: null,
        },
        capabilities: {
          advancedAnalytics: { state: "disabled", limits: null },
          apiAccess: { state: "disabled", limits: null },
        },
        overrides: {
          isPlatformAdmin: false,
          isCompanyOwner: true,
          isCompanyAdmin: true,
          isFoundingAccount: true,
        },
      },
    });

    expect(hasCompanyCapabilityAccess(context, "advancedAnalytics")).toBe(true);
    expect(isCompanyAdvancedAnalyticsEnabled(context)).toBe(true);
    expect(isCompanyPremiumAdvancedStatsEnabled(context)).toBe(true);
    expect(hasCompanyCapabilityAccess(context, "apiAccess", ["read_only"])).toBe(false);
  });

  it("reads user capabilities from entitlements first and falls back to legacy values", () => {
    const userWithEntitlements = createUserContext({
      capabilities: {
        basicAnalytics: { state: "enabled", limits: null },
      },
      entitlements: {
        planType: "user_pro",
        subscriptionStatus: "active",
        quotas: {
          activeProducts: 5,
          teamMembers: null,
        },
        capabilities: {
          basicAnalytics: { state: "disabled", limits: null },
        },
        overrides: {
          isPlatformAdmin: false,
          isCompanyOwner: false,
          isCompanyAdmin: false,
          isFoundingAccount: false,
        },
      },
    });

    expect(getUserCapability(userWithEntitlements, "basicAnalytics")?.state).toBe("disabled");
    expect(hasUserCapabilityAccess(userWithEntitlements, "basicAnalytics")).toBe(false);
    expect(isUserBasicAnalyticsEnabled(userWithEntitlements)).toBe(false);

    const legacyOnlyUser = createUserContext({
      entitlements: null,
      capabilities: {
        basicAnalytics: { state: "read_only", limits: null },
      },
    });

    expect(getUserCapability(legacyOnlyUser, "basicAnalytics")?.state).toBe("read_only");
    expect(hasUserCapabilityAccess(legacyOnlyUser, "basicAnalytics")).toBe(true);
    expect(isUserBasicAnalyticsEnabled(legacyOnlyUser)).toBe(true);
  });

  it("evaluates inventory management access from the capability state", () => {
    const enabledCapability: InventoryManagementCapability = {
      state: "enabled",
      limits: {
        maxProductsWithInventory: 20,
        maxQuantityPerProduct: 10,
      },
    };
    const readOnlyCapability: InventoryManagementCapability = {
      state: "read_only",
      limits: {
        maxProductsWithInventory: 20,
        maxQuantityPerProduct: 10,
      },
    };
    const disabledCapability: InventoryManagementCapability = {
      state: "disabled",
      limits: {
        maxProductsWithInventory: null,
        maxQuantityPerProduct: null,
      },
    };

    expect(canManageInventoryCapability(enabledCapability)).toBe(true);
    expect(canManageInventoryCapability(readOnlyCapability)).toBe(false);
    expect(canManageInventoryCapability(undefined)).toBe(false);

    expect(hasInventoryReadAccess(enabledCapability)).toBe(true);
    expect(hasInventoryReadAccess(readOnlyCapability)).toBe(true);
    expect(hasInventoryReadAccess(disabledCapability)).toBe(false);
  });
});
