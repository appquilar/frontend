import { useQuery } from "@tanstack/react-query";
import { authService } from "@/composition/auth";
import { isAuthenticated as hasAuthenticatedSession } from "@/domain/models/AuthSession";

export function useCurrentUser() {
    const session = authService.getCurrentSessionSync();
    const isAuthenticated = hasAuthenticatedSession(session);

    const query = useQuery({
        queryKey: ["currentUser"],
        queryFn: () => {
            if (!isAuthenticated) return null;
            return authService.getCurrentUser();
        },
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 5,
    });

    return {
        user: isAuthenticated ? query.data ?? null : null,
        isAuthenticated: isAuthenticated && Boolean(query.data),
        isLoading: isAuthenticated && query.isLoading,
        error: isAuthenticated ? query.error : null,
        refetch: query.refetch,
    };
}
