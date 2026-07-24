import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "react-router-dom";
import {
    addressFormSchema,
    AddressFormValues,
    passwordFormSchema,
    PasswordFormValues,
    profileFormSchema,
    ProfileFormValues,
} from "@/domain/schemas/userConfigSchema";
import { userService, mediaService } from "@/compositionRoot";

const toFormString = (value: string | null | undefined): string => value ?? "";

export const useUserConfig = () => {
    const {
        currentUser,
        refreshCurrentUser,
        changePassword,
    } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState("profile");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    useEffect(() => {
        const tabParam = searchParams.get("tab");
        if (tabParam && ["profile", "password", "address"].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    const profileForm = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            firstName: toFormString(currentUser?.firstName),
            lastName: toFormString(currentUser?.lastName),
            email: toFormString(currentUser?.email),
            profilePicture: "",
        },
    });

    useEffect(() => {
        if (currentUser) {
            profileForm.reset({
                firstName: toFormString(currentUser.firstName),
                lastName: toFormString(currentUser.lastName),
                email: toFormString(currentUser.email),
                profilePicture: "",
            });
        }
    }, [currentUser, profileForm]);

    const passwordForm = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });

    const addressForm = useForm<AddressFormValues>({
        resolver: zodResolver(addressFormSchema),
        defaultValues: {
            street: toFormString(currentUser?.address?.street),
            street2: toFormString(currentUser?.address?.street2),
            city: toFormString(currentUser?.address?.city),
            state: toFormString(currentUser?.address?.state),
            country: toFormString(currentUser?.address?.country),
            postalCode: toFormString(currentUser?.address?.postalCode),
            latitude:
                typeof currentUser?.location?.latitude === "number"
                    ? currentUser.location.latitude
                    : undefined,
            longitude:
                typeof currentUser?.location?.longitude === "number"
                    ? currentUser.location.longitude
                    : undefined,
        },
    });

    useEffect(() => {
        if (!currentUser) {
            return;
        }

        addressForm.reset({
            street: toFormString(currentUser.address?.street),
            street2: toFormString(currentUser.address?.street2),
            city: toFormString(currentUser.address?.city),
            state: toFormString(currentUser.address?.state),
            country: toFormString(currentUser.address?.country),
            postalCode: toFormString(currentUser.address?.postalCode),
            latitude:
                typeof currentUser.location?.latitude === "number"
                    ? currentUser.location.latitude
                    : undefined,
            longitude:
                typeof currentUser.location?.longitude === "number"
                    ? currentUser.location.longitude
                    : undefined,
        });
    }, [currentUser, addressForm]);

    const onImageUpload = async (file: File) => {
        if (!currentUser) return;

        const toastId = toast.loading("Actualizando foto de perfil...");

        try {
            const previousImageId = currentUser.profilePictureId ?? null;
            const newImageId = await mediaService.uploadImage(file);

            await userService.updateUser(currentUser.id, {
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                email: currentUser.email,
                profilePictureId: newImageId,
            });

            if (previousImageId) {
                try {
                    await mediaService.deleteImage(previousImageId);
                } catch (error) {
                    console.warn("Failed to delete old image after unlinking it from the user.", error);
                }
            }

            await refreshCurrentUser();
            toast.success("Foto de perfil actualizada", { id: toastId });
        } catch (error) {
            console.error("Error updating profile picture:", error);
            toast.error("Error al actualizar la foto", { id: toastId });
            profileForm.setValue("profilePicture", "");
        }
    };

    const onImageRemove = async () => {
        if (!currentUser || !currentUser.profilePictureId) {
            profileForm.setValue("profilePicture", "");
            return;
        }

        const toastId = toast.loading("Eliminando foto de perfil...");

        try {
            const previousImageId = currentUser.profilePictureId;

            await userService.updateUser(currentUser.id, {
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                email: currentUser.email,
                profilePictureId: null,
            });

            try {
                await mediaService.deleteImage(previousImageId);
            } catch (error) {
                console.warn("Failed to delete unlinked profile image.", error);
            }

            await refreshCurrentUser();
            profileForm.setValue("profilePicture", "");

            toast.success("Foto de perfil eliminada", { id: toastId });
        } catch (error) {
            console.error("Error deleting profile picture:", error);
            toast.error("Error al eliminar la foto de perfil", { id: toastId });
        }
    };

    const onProfileSubmit = async (data: ProfileFormValues) => {
        if (!currentUser) return;

        try {
            await userService.updateUser(currentUser.id, {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                profilePictureId:
                    currentUser.profilePictureId !== undefined
                        ? currentUser.profilePictureId
                        : null,
            });

            await refreshCurrentUser();
            toast.success("Perfil actualizado correctamente");
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Error al guardar los cambios del perfil");
        }
    };

    const onPasswordSubmit = async (data: PasswordFormValues) => {
        try {
            await changePassword(data.currentPassword, data.newPassword);
            passwordForm.reset();
            toast.success("Contraseña actualizada correctamente");
        } catch (error) {
            console.error("Error changing password:", error);
            toast.error(
                "No se ha podido actualizar la contraseña. Revisa los datos e inténtalo de nuevo.",
            );
        }
    };

    const onAddressSubmit = async (data: AddressFormValues) => {
        if (!currentUser) return;
        try {
            await userService.updateUserAddress(currentUser.id, {
                address: {
                    street: data.street,
                    street2: data.street2 || undefined,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postalCode: data.postalCode,
                },
                location:
                    typeof data.latitude === "number" &&
                    typeof data.longitude === "number"
                        ? {
                            latitude: data.latitude,
                            longitude: data.longitude,
                        }
                        : undefined,
            });

            await refreshCurrentUser();
            toast.success("Dirección guardada correctamente");
        } catch (error) {
            console.error("Error updating address:", error);
            toast.error("Error al guardar la dirección");
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    };

    const getActiveTabTitle = () => {
        switch (activeTab) {
            case "profile":
                return "Perfil";
            case "password":
                return "Contraseña";
            case "address":
                return "Dirección";
            default:
                return "Perfil";
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setIsDrawerOpen(false);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", value);
            return next;
        });
    };

    return {
        activeTab,
        setActiveTab,
        isDrawerOpen,
        setIsDrawerOpen,
        profileForm,
        passwordForm,
        addressForm,
        onProfileSubmit,
        onImageUpload,
        onImageRemove,
        onPasswordSubmit,
        onAddressSubmit,
        getInitials,
        getActiveTabTitle,
        handleTabChange,
        currentUser,
    };
};
