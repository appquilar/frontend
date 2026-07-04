import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useCompanyProfile, useUpdateCompanyProfile } from "@/application/hooks/useCompanyProfile";
import { useMediaActions } from "@/application/hooks/useMediaActions";
import FormHeader from "../common/FormHeader";
import LoadingSpinner from "../common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAddressMap } from "@/components/dashboard/hooks/useAddressMap";
import CompanySubscriptionSettingsCard from "./CompanySubscriptionSettingsCard";
import CompanyImageField from "./CompanyImageField";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/components/dashboard/forms/image-upload/imageUtils";
import { AdminCompanyStatsSection } from "@/components/dashboard/stats/AdminCompanyStatsSection";
import { UserRole } from "@/domain/models/UserRole";
import { isCompanyAdminUser, isCompanyOwnerUser } from "@/domain/models/User";
import AccessRestricted from "@/components/dashboard/user-management/AccessRestricted";

const DEFAULT_PHONE_COUNTRY_CODE = "ES";
const DEFAULT_PHONE_PREFIX = "+34";

const companyProfileSchema = z.object({
    name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
    slug: z.string().min(2, { message: "El slug es obligatorio" }),
    description: z.string().optional(),
    fiscalIdentifier: z.string().optional(),
    contactEmail: z.union([z.literal(""), z.string().email({ message: "Email inválido" })]),
    phoneCountryCode: z.string().optional(),
    phonePrefix: z.string().optional(),
    phoneNumber: z.string().optional(),
    street: z.string().min(1, { message: "La calle es obligatoria" }),
    street2: z.string().optional(),
    city: z.string().min(1, { message: "La ciudad es obligatoria" }),
    state: z.string().min(1, { message: "La provincia/estado es obligatorio" }),
    country: z.string().min(1, { message: "El país es obligatorio" }),
    postalCode: z.string().min(1, { message: "El código postal es obligatorio" }),
    profilePictureId: z.string().uuid().nullable().optional(),
    headerImageId: z.string().uuid().nullable().optional(),
    latitude: z.number({ required_error: "Selecciona ubicación en el mapa" }),
    longitude: z.number({ required_error: "Selecciona ubicación en el mapa" }),
}).superRefine((value, ctx) => {
    const phoneNumber = value.phoneNumber?.trim() ?? "";

    if (phoneNumber.length === 0) {
        return;
    }

    if (phoneNumber.length < 6) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Debe ser un número de teléfono válido",
            path: ["phoneNumber"],
        });
    }

    if ((value.phoneCountryCode?.trim() ?? "").length < 2) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "País obligatorio",
            path: ["phoneCountryCode"],
        });
    }

    if ((value.phonePrefix?.trim() ?? "").length < 2) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Prefijo obligatorio",
            path: ["phonePrefix"],
        });
    }
});

type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;
type CompanyImageFieldName = "profilePictureId" | "headerImageId";

const CompanyFormPage = () => {
    const { companyId, id } = useParams();
    const { currentUser, hasRole } = useAuth();

    const resolvedCompanyId = companyId ?? id ?? currentUser?.companyId ?? null;
    const isPlatformAdmin = hasRole(UserRole.ADMIN);
    const canManageCompany = isPlatformAdmin || isCompanyOwnerUser(currentUser) || isCompanyAdminUser(currentUser);
    const profileQuery = useCompanyProfile(resolvedCompanyId);
    const updateMutation = useUpdateCompanyProfile();
    const { uploadImage, deleteImage } = useMediaActions();
    const [uploadingField, setUploadingField] = useState<CompanyImageFieldName | null>(null);

    const form = useForm<CompanyProfileFormValues>({
        resolver: zodResolver(companyProfileSchema),
        defaultValues: {
            name: "",
            slug: "",
            description: "",
            fiscalIdentifier: "",
            contactEmail: "",
            phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
            phonePrefix: DEFAULT_PHONE_PREFIX,
            phoneNumber: "",
            street: "",
            street2: "",
            city: "",
            state: "",
            country: "",
            postalCode: "",
            profilePictureId: null,
            headerImageId: null,
            latitude: 40.4168,
            longitude: -3.7038,
        },
    });

    useEffect(() => {
        if (!profileQuery.data) {
            return;
        }

        form.reset({
            name: profileQuery.data.name ?? "",
            slug: profileQuery.data.slug ?? "",
            description: profileQuery.data.description ?? "",
            fiscalIdentifier: profileQuery.data.fiscalIdentifier ?? "",
            contactEmail: profileQuery.data.contactEmail ?? "",
            phoneCountryCode: profileQuery.data.phoneNumber?.countryCode ?? DEFAULT_PHONE_COUNTRY_CODE,
            phonePrefix: profileQuery.data.phoneNumber?.prefix ?? DEFAULT_PHONE_PREFIX,
            phoneNumber: profileQuery.data.phoneNumber?.number ?? "",
            street: profileQuery.data.address?.street ?? "",
            street2: profileQuery.data.address?.street2 ?? "",
            city: profileQuery.data.address?.city ?? "",
            state: profileQuery.data.address?.state ?? "",
            country: profileQuery.data.address?.country ?? "",
            postalCode: profileQuery.data.address?.postalCode ?? "",
            profilePictureId: profileQuery.data.profilePictureId ?? null,
            headerImageId: profileQuery.data.headerImageId ?? null,
            latitude: profileQuery.data.location?.latitude ?? 40.4168,
            longitude: profileQuery.data.location?.longitude ?? -3.7038,
        });
    }, [profileQuery.data, form]);

    const {
        autocompleteContainerRef,
        mapContainerRef,
        mapsError,
    } = useAddressMap(
        form,
        !profileQuery.isLoading && !profileQuery.isError
    );
    const latitude = form.watch("latitude");
    const longitude = form.watch("longitude");
    const phoneCountryCode = form.watch("phoneCountryCode");
    const phonePrefix = form.watch("phonePrefix");
    const phoneNumber = form.watch("phoneNumber");
    const companyName = form.watch("name");
    const profilePictureId = form.watch("profilePictureId");
    const headerImageId = form.watch("headerImageId");
    const phoneError =
        form.formState.errors.phoneCountryCode?.message
        ?? form.formState.errors.phonePrefix?.message
        ?? form.formState.errors.phoneNumber?.message;

    const validateImageFile = (file: File): string | null => {
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return "Usa una imagen JPEG o PNG.";
        }

        if (file.size > MAX_FILE_SIZE) {
            return "La imagen no puede superar los 2MB.";
        }

        return null;
    };

    const getPersistedImageId = (fieldName: CompanyImageFieldName): string | null => {
        if (!profileQuery.data) {
            return null;
        }

        return fieldName === "profilePictureId"
            ? profileQuery.data.profilePictureId ?? null
            : profileQuery.data.headerImageId ?? null;
    };

    const handleSelectImage = async (fieldName: CompanyImageFieldName, file: File) => {
        const validationError = validateImageFile(file);
        if (validationError) {
            form.setError(fieldName, {
                type: "manual",
                message: validationError,
            });
            return;
        }

        const previousValue = form.getValues(fieldName) ?? null;
        const persistedValue = getPersistedImageId(fieldName);

        form.clearErrors(fieldName);
        setUploadingField(fieldName);

        try {
            const nextImageId = await uploadImage(file);
            form.setValue(fieldName, nextImageId, {
                shouldDirty: true,
                shouldValidate: true,
            });

            if (previousValue && previousValue !== persistedValue && previousValue !== nextImageId) {
                try {
                    await deleteImage(previousValue);
                } catch (error) {
                    console.warn("Could not delete previous temporary image", error);
                }
            }
        } catch (error) {
            console.error("Error uploading company image", error);
            form.setError(fieldName, {
                type: "manual",
                message: "No se pudo subir la imagen.",
            });
        } finally {
            setUploadingField((currentValue) => (currentValue === fieldName ? null : currentValue));
        }
    };

    const handleRemoveImage = async (fieldName: CompanyImageFieldName) => {
        const currentValue = form.getValues(fieldName) ?? null;
        const persistedValue = getPersistedImageId(fieldName);

        form.setValue(fieldName, null, {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.clearErrors(fieldName);

        if (currentValue && currentValue !== persistedValue) {
            try {
                await deleteImage(currentValue);
            } catch (error) {
                console.warn("Could not delete temporary company image", error);
            }
        }
    };

    const onSubmit = async (data: CompanyProfileFormValues) => {
        if (!resolvedCompanyId) {
            toast.error("No hay empresa asociada al usuario.");
            return;
        }

        const normalizedPhoneNumber = data.phoneNumber?.trim() ?? "";
        const hasPhoneNumber = normalizedPhoneNumber.length > 0;
        const previousProfilePictureId = profileQuery.data.profilePictureId ?? null;
        const previousHeaderImageId = profileQuery.data.headerImageId ?? null;

        try {
            await updateMutation.mutateAsync({
                companyId: resolvedCompanyId,
                name: data.name.trim(),
                slug: data.slug.trim(),
                description: data.description?.trim() || null,
                fiscalIdentifier: data.fiscalIdentifier?.trim() || null,
                contactEmail: data.contactEmail?.trim() || null,
                phoneNumber: hasPhoneNumber
                    ? {
                        countryCode: data.phoneCountryCode?.trim() || DEFAULT_PHONE_COUNTRY_CODE,
                        prefix: data.phonePrefix?.trim() || DEFAULT_PHONE_PREFIX,
                        number: normalizedPhoneNumber,
                    }
                    : null,
                address: {
                    street: data.street.trim(),
                    street2: data.street2?.trim() || null,
                    city: data.city.trim(),
                    state: data.state.trim(),
                    country: data.country.trim(),
                    postalCode: data.postalCode.trim(),
                },
                location: {
                    latitude: data.latitude,
                    longitude: data.longitude,
                },
                profilePictureId: data.profilePictureId ?? null,
                headerImageId: data.headerImageId ?? null,
            });

            await Promise.allSettled([
                previousProfilePictureId && previousProfilePictureId !== (data.profilePictureId ?? null)
                    ? deleteImage(previousProfilePictureId)
                    : Promise.resolve(),
                previousHeaderImageId && previousHeaderImageId !== (data.headerImageId ?? null)
                    ? deleteImage(previousHeaderImageId)
                    : Promise.resolve(),
            ]);

            toast.success("Empresa actualizada correctamente.");
        } catch (error) {
            console.error("Error updating company profile", error);
            toast.error("No se pudo guardar la empresa.");
        }
    };

    if (!resolvedCompanyId) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    No hay empresa asociada a tu usuario.
                </p>
            </div>
        );
    }

    if (!canManageCompany) {
        return <AccessRestricted />;
    }

    if (profileQuery.isLoading) {
        return <LoadingSpinner />;
    }

    if (profileQuery.isError || !profileQuery.data) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-destructive">
                    No se pudo cargar la información de la empresa.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <FormHeader
                title="Mi empresa"
                backUrl="/dashboard"
            />

            <CompanySubscriptionSettingsCard />

            <Card>
                <CardHeader>
                    <CardTitle>Datos de empresa</CardTitle>
                    <CardDescription>
                        Organiza la identidad, el contacto y la ubicación pública de tu empresa.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <section className="space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                                        Identidad y contacto
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Presenta la marca y define cómo deben localizarte clientes y equipo.
                                    </p>
                                </div>

                                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                                    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-5">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Nombre</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="Nombre de empresa" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="slug"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Slug</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="mi-empresa" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Descripción</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            {...field}
                                                            value={field.value ?? ""}
                                                            placeholder="Explica qué hace especial a tu empresa, su especialidad o el tipo de catálogo que ofrece."
                                                            className="min-h-[144px] resize-y"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-5">
                                        <FormField
                                            control={form.control}
                                            name="contactEmail"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Email de contacto</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            value={field.value ?? ""}
                                                            type="email"
                                                            placeholder="contacto@empresa.com"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="space-y-2">
                                            <label
                                                htmlFor="company-phone-number"
                                                className="text-sm font-medium leading-none"
                                            >
                                                Teléfono de contacto
                                            </label>
                                            <PhoneNumberInput
                                                id="company-phone-number"
                                                countryCode={phoneCountryCode}
                                                prefix={phonePrefix}
                                                number={phoneNumber}
                                                invalid={Boolean(phoneError)}
                                                onCountryChange={({ countryCode, prefix }) => {
                                                    form.setValue("phoneCountryCode", countryCode, {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    });
                                                    form.setValue("phonePrefix", prefix, {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    });
                                                }}
                                                onNumberChange={(value) => {
                                                    form.setValue("phoneNumber", value, {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    });
                                                }}
                                            />
                                            {phoneError && (
                                                <p className="text-sm font-medium text-destructive">
                                                    {phoneError}
                                                </p>
                                            )}
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="fiscalIdentifier"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>CIF / NIF</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            value={field.value ?? ""}
                                                            placeholder="B12345678"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
                                    <FormField
                                        control={form.control}
                                        name="profilePictureId"
                                        render={({ fieldState }) => (
                                            <FormItem>
                                                <CompanyImageField
                                                    title="Imagen de perfil"
                                                    description="Se usa como avatar público en la ficha de empresa y en los bloques donde se referencia a tu marca."
                                                    mediaId={profilePictureId ?? null}
                                                    companyName={companyName || profileQuery.data.name}
                                                    imageSize="MEDIUM"
                                                    variant="avatar"
                                                    isUploading={uploadingField === "profilePictureId"}
                                                    error={fieldState.error?.message}
                                                    onSelectFile={(file) => handleSelectImage("profilePictureId", file)}
                                                    onRemove={() => handleRemoveImage("profilePictureId")}
                                                />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="headerImageId"
                                        render={({ fieldState }) => (
                                            <FormItem>
                                                <CompanyImageField
                                                    title="Imagen de cabecera"
                                                    description="Aparece en la cabecera del perfil público de empresa para darle más presencia visual."
                                                    mediaId={headerImageId ?? null}
                                                    companyName={companyName || profileQuery.data.name}
                                                    imageSize="LARGE"
                                                    variant="banner"
                                                    isUploading={uploadingField === "headerImageId"}
                                                    error={fieldState.error?.message}
                                                    onSelectFile={(file) => handleSelectImage("headerImageId", file)}
                                                    onRemove={() => handleRemoveImage("headerImageId")}
                                                />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                                        Dirección y ubicación
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Esta información se usa para operar el catálogo y posicionar la empresa en el mapa.
                                    </p>
                                </div>

                                <div className="space-y-5 rounded-xl border border-border/70 bg-muted/15 p-5">
                                    <div className="space-y-1">
                                        <FormLabel>Buscar dirección</FormLabel>
                                        <div
                                            ref={autocompleteContainerRef}
                                            className="min-h-10"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Busca la dirección para autocompletar el formulario y ajustar el pin con más precisión.
                                        </p>
                                        {mapsError && (
                                            <p className="text-xs text-destructive">
                                                {mapsError}
                                            </p>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <FormField
                                            control={form.control}
                                            name="street"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Calle y número</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="street2"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Dirección adicional</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} value={field.value ?? ""} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <FormField
                                            control={form.control}
                                            name="city"
                                            render={({ field }) => (
                                                <FormItem className="xl:col-span-1">
                                                    <FormLabel>Ciudad</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="state"
                                            render={({ field }) => (
                                                <FormItem className="xl:col-span-1">
                                                    <FormLabel>Provincia / Estado</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="postalCode"
                                            render={({ field }) => (
                                                <FormItem className="xl:col-span-1">
                                                    <FormLabel>Código postal</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="country"
                                            render={({ field }) => (
                                                <FormItem className="xl:col-span-1">
                                                    <FormLabel>País</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <FormLabel>Ubicación en el mapa</FormLabel>
                                        <div
                                            ref={mapContainerRef}
                                            className="h-[320px] w-full overflow-hidden rounded-md border"
                                        />
                                        {typeof latitude === "number" && typeof longitude === "number" && (
                                            <p className="text-xs text-muted-foreground">
                                                Coordenadas: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <CardFooter className="!px-0 !pb-0 !pt-4 border-t mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="submit"
                                        disabled={updateMutation.isPending || uploadingField !== null}
                                    >
                                        {updateMutation.isPending
                                            ? "Guardando..."
                                            : uploadingField !== null
                                                ? "Subiendo imagen..."
                                                : "Guardar cambios"}
                                    </Button>
                                    <Button asChild variant="outline">
                                        <Link to={`/dashboard/companies/${resolvedCompanyId}/users`}>
                                            Usuarios empresa
                                        </Link>
                                    </Button>
                                </div>
                            </CardFooter>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {isPlatformAdmin && (
                <AdminCompanyStatsSection
                    companyId={resolvedCompanyId}
                    companyName={profileQuery.data.name}
                />
            )}
        </div>
    );
};

export default CompanyFormPage;
