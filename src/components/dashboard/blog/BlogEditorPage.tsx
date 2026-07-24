import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { ArrowLeft, CalendarClock, Globe, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useBlogImageUpload } from '@/application/hooks/useBlogImageUpload';
import {
    BLOG_STATUSES,
    useAdminBlogCategories,
    useAdminBlogPost,
    useCreateBlogPost,
    useDeleteBlogPost,
    useDraftBlogPost,
    usePublishBlogPost,
    useScheduleBlogPost,
    useUpdateBlogPost,
} from '@/application/hooks/useBlog';
import type { BlogPostStatus } from '@/domain/models/BlogPost';
import { Uuid } from '@/domain/valueObject/uuidv4';
import RichTextEditor from '@/components/shared/RichTextEditor';
import GoogleSnippetPreview from '@/components/blog/GoogleSnippetPreview';
import BlogSingleImageUploader from '@/components/dashboard/blog/BlogSingleImageUploader';

interface BlogEditorFormValues {
    categoryId: string;
    title: string;
    excerpt: string;
    keywords: string;
    body: string;
    headerImageId: string | null;
    heroImageId: string | null;
    status: BlogPostStatus;
    scheduledFor: string;
}

const stripHtml = (value: string): string => {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const toSlugLike = (value: string): string => {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
};

const todayIsoDate = (): string => {
    return new Date().toISOString().slice(0, 10);
};

const parseKeywords = (raw: string): string[] => {
    return raw
        .split(',')
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0);
};

const BlogEditorPage = () => {
    const { postId } = useParams();
    const navigate = useNavigate();

    const isCreateMode = !postId || postId === 'new';

    const { data: post, isLoading } = useAdminBlogPost(postId, !isCreateMode);
    const { data: categories = [], isLoading: isLoadingCategories } = useAdminBlogCategories();

    const { mutateAsync: createPost, isPending: isCreating } = useCreateBlogPost();
    const { mutateAsync: updatePost, isPending: isUpdating } = useUpdateBlogPost();
    const { mutateAsync: deletePost, isPending: isDeleting } = useDeleteBlogPost();
    const { mutateAsync: publishPost, isPending: isPublishing } = usePublishBlogPost();
    const { mutateAsync: draftPost, isPending: isDrafting } = useDraftBlogPost();
    const { mutateAsync: schedulePost, isPending: isScheduling } = useScheduleBlogPost();
    const { uploadImage, isUploading } = useBlogImageUpload();

    const {
        control,
        register,
        handleSubmit,
        watch,
        setValue,
        setError,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<BlogEditorFormValues>({
        defaultValues: {
            categoryId: '',
            title: '',
            excerpt: '',
            keywords: '',
            body: '',
            headerImageId: null,
            heroImageId: null,
            status: 'draft',
            scheduledFor: '',
        },
    });

    useEffect(() => {
        if (!post || isCreateMode) {
            return;
        }

        reset({
            categoryId: post.category?.categoryId ?? '',
            title: post.title,
            excerpt: post.excerpt,
            keywords: post.keywords.join(', '),
            body: post.body ?? '',
            headerImageId: post.headerImageId,
            heroImageId: post.heroImageId,
            status: post.status,
            scheduledFor: post.scheduledFor ?? '',
        });
    }, [post, reset, isCreateMode]);

    const categoryIdValue = watch('categoryId');
    const titleValue = watch('title');
    const excerptValue = watch('excerpt');
    const keywordsValue = watch('keywords');
    const bodyValue = watch('body');
    const headerImageId = watch('headerImageId');
    const heroImageId = watch('heroImageId');
    const statusValue = watch('status');
    const scheduledForValue = watch('scheduledFor');

    const selectedCategory = useMemo(() => {
        return categories.find((category) => category.categoryId === categoryIdValue) ?? null;
    }, [categories, categoryIdValue]);

    const previewDescription = useMemo(() => {
        const fromExcerpt = excerptValue.trim();
        if (fromExcerpt.length > 0) {
            return fromExcerpt.slice(0, 155);
        }

        return stripHtml(bodyValue || '').slice(0, 155);
    }, [excerptValue, bodyValue]);

    const previewSlug = useMemo(() => {
        if (post?.slug) {
            return `/blog/${post.slug}`;
        }

        const categorySlug = selectedCategory?.slug || 'categoria';
        const publicationDate = statusValue === 'scheduled' && scheduledForValue
            ? scheduledForValue
            : todayIsoDate();
        const titleSlug = toSlugLike(titleValue || 'nuevo-post') || 'nuevo-post';

        return `/blog/${categorySlug}/${publicationDate}/${titleSlug}`;
    }, [post?.slug, selectedCategory?.slug, statusValue, scheduledForValue, titleValue]);

    const handleUploadImage = async (
        field: 'headerImageId' | 'heroImageId',
        file: File,
    ): Promise<void> => {
        try {
            const imageId = await uploadImage(file);
            setValue(field, imageId, { shouldDirty: true, shouldValidate: true });
        } catch {
            setError(field, {
                type: 'manual',
                message: 'No se pudo subir la imagen.',
            });
        }
    };

    const persistFormChanges = async (
        values: BlogEditorFormValues,
        options: { navigateAfterCreate: boolean },
    ): Promise<boolean> => {
        const keywords = parseKeywords(values.keywords);
        if (!values.categoryId) {
            setError('categoryId', { type: 'manual', message: 'La categoría es obligatoria.' });
            return false;
        }

        if (!values.title.trim()) {
            setError('title', { type: 'manual', message: 'El título es obligatorio.' });
            return false;
        }

        if (!values.excerpt.trim()) {
            setError('excerpt', { type: 'manual', message: 'El extracto es obligatorio.' });
            return false;
        }

        if (!stripHtml(values.body).trim()) {
            setError('body', { type: 'manual', message: 'El contenido es obligatorio.' });
            return false;
        }

        if (isCreateMode) {
            if (values.status === 'scheduled' && !values.scheduledFor) {
                setError('scheduledFor', {
                    type: 'manual',
                    message: 'La fecha de programación es obligatoria cuando el estado es programado.',
                });
                return false;
            }

            await createPost({
                postId: Uuid.generate().toString(),
                categoryId: values.categoryId,
                title: values.title.trim(),
                excerpt: values.excerpt.trim(),
                keywords,
                body: values.body,
                headerImageId: values.headerImageId,
                heroImageId: values.heroImageId,
                status: values.status,
                scheduledFor: values.status === 'scheduled' ? values.scheduledFor : null,
            });

            if (options.navigateAfterCreate) {
                navigate('/dashboard/blog');
            }

            return true;
        }

        await updatePost({
            postId: postId as string,
            payload: {
                categoryId: values.categoryId,
                title: values.title.trim(),
                excerpt: values.excerpt.trim(),
                keywords,
                body: values.body,
                headerImageId: values.headerImageId,
                heroImageId: values.heroImageId,
            },
        });

        return true;
    };

    const onSubmit = async (values: BlogEditorFormValues) => {
        await persistFormChanges(values, { navigateAfterCreate: true });
    };

    const executeStatusAction = (
        action: 'publish' | 'draft' | 'schedule',
    ) => {
        return handleSubmit(async (values) => {
            const saved = await persistFormChanges(values, { navigateAfterCreate: false });
            if (!saved || isCreateMode || !postId) {
                return;
            }

            if (action === 'schedule') {
                if (!values.scheduledFor) {
                    setError('scheduledFor', {
                        type: 'manual',
                        message: 'Selecciona una fecha para programar.',
                    });
                    return;
                }

                await schedulePost({ postId, scheduledFor: values.scheduledFor });
                return;
            }

            if (action === 'publish') {
                await publishPost(postId);
                return;
            }

            await draftPost(postId);
        });
    };

    const canSubmit = isSubmitting || isUploading || isCreating || isUpdating || isLoadingCategories;
    const isRunningStatusAction = isPublishing || isDrafting || isScheduling || canSubmit;

    if (!isCreateMode && isLoading) {
        return (
            <div className="p-6">
                <div className="h-64 animate-pulse rounded-lg bg-muted" />
            </div>
        );
    }

    if (!isCreateMode && !post) {
        return (
            <div className="space-y-4 p-6">
                <p className="text-sm text-muted-foreground">No se encontró el post solicitado.</p>
                <Link to="/dashboard/blog">
                    <Button variant="outline">Volver al blog</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                    <Link to="/dashboard/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft size={15} />
                        Volver al listado
                    </Link>
                    <h1 className="text-2xl font-bold">{isCreateMode ? 'Nuevo post' : 'Editar post'}</h1>
                </div>

                {!isCreateMode && post?.slug && (
                    <Link to={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="gap-2">
                            <Globe size={16} />
                            Ver en web pública
                        </Button>
                    </Link>
                )}
            </div>

            {!isLoadingCategories && categories.length === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Necesitas crear al menos una categoría para publicar en el blog.
                    {' '}
                    <Link to="/dashboard/blog" className="font-medium underline">
                        Ir a gestión de categorías
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]">
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Contenido</CardTitle>
                            <CardDescription>Título, extracto, cuerpo y medios principales del post.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Categoría</Label>
                                    <Controller
                                        control={control}
                                        name="categoryId"
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona categoría" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map((category) => (
                                                        <SelectItem key={category.categoryId} value={category.categoryId}>
                                                            {category.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.categoryId?.message && (
                                        <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                                    )}
                                </div>

                                {isCreateMode && (
                                    <div className="space-y-2">
                                        <Label>Estado inicial</Label>
                                        <Controller
                                            control={control}
                                            name="status"
                                            render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Estado" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {BLOG_STATUSES.map((status) => (
                                                            <SelectItem key={status.value} value={status.value}>
                                                                {status.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>

                            {isCreateMode && (
                                <div className="space-y-2">
                                    <Label htmlFor="scheduledFor">Programar para (fecha)</Label>
                                    <Input
                                        id="scheduledFor"
                                        type="date"
                                        lang="es-ES"
                                        {...register('scheduledFor')}
                                        disabled={statusValue !== 'scheduled'}
                                    />
                                    {errors.scheduledFor?.message && (
                                        <p className="text-sm text-destructive">{errors.scheduledFor.message}</p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="title">Título</Label>
                                <Input
                                    id="title"
                                    placeholder="Escribe un título"
                                    {...register('title')}
                                />
                                {errors.title?.message && (
                                    <p className="text-sm text-destructive">{errors.title.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <Label htmlFor="excerpt">Extracto</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {excerptValue.length}/320
                                    </span>
                                </div>
                                <Textarea
                                    id="excerpt"
                                    rows={3}
                                    maxLength={320}
                                    placeholder="Este texto es el que se mostrará en el listado de posts"
                                    {...register('excerpt')}
                                />
                                {errors.excerpt?.message && (
                                    <p className="text-sm text-destructive">{errors.excerpt.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="keywords">Keywords SEO (separadas por coma)</Label>
                                <Input
                                    id="keywords"
                                    placeholder="alquiler, movilidad, bicicletas"
                                    {...register('keywords')}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Se usarán para la meta `keywords` y para organización SEO del post.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Contenido</Label>
                                <Controller
                                    control={control}
                                    name="body"
                                    render={({ field }) => (
                                        <RichTextEditor value={field.value || ''} onChange={field.onChange} />
                                    )}
                                />
                                {errors.body?.message && (
                                    <p className="text-sm text-destructive">{errors.body.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <BlogSingleImageUploader
                                    label="Imagen cabecera"
                                    mediaId={headerImageId}
                                    alt="Imagen cabecera"
                                    isUploading={isUploading}
                                    onSelectFile={(file) => handleUploadImage('headerImageId', file)}
                                    onRemove={() => setValue('headerImageId', null, { shouldDirty: true })}
                                />

                                <BlogSingleImageUploader
                                    label="Hero imagen"
                                    mediaId={heroImageId}
                                    alt="Hero imagen"
                                    isUploading={isUploading}
                                    onSelectFile={(file) => handleUploadImage('heroImageId', file)}
                                    onRemove={() => setValue('heroImageId', null, { shouldDirty: true })}
                                />
                            </div>

                            {(errors.headerImageId?.message || errors.heroImageId?.message) && (
                                <div className="space-y-1">
                                    {errors.headerImageId?.message && (
                                        <p className="text-sm text-destructive">{errors.headerImageId.message}</p>
                                    )}
                                    {errors.heroImageId?.message && (
                                        <p className="text-sm text-destructive">{errors.heroImageId.message}</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-end gap-2">
                        <Link to="/dashboard/blog">
                            <Button type="button" variant="outline">Cancelar</Button>
                        </Link>
                        <Button type="submit" disabled={canSubmit || categories.length === 0}>
                            {isCreateMode ? "Crear post" : "Guardar cambios"}
                        </Button>
                    </div>
                </form>

                <div className="space-y-6">
                    <GoogleSnippetPreview
                        title={titleValue || 'Título del artículo'}
                        slug={previewSlug}
                        description={previewDescription}
                        keywords={keywordsValue}
                    />

                    {!isCreateMode && post && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Publicación</CardTitle>
                                <CardDescription>
                                    Estado actual: <span className="font-medium">{post.status}</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    className="w-full"
                                    onClick={() => void executeStatusAction('publish')()}
                                    disabled={isRunningStatusAction || categories.length === 0}
                                >
                                    Publicar ahora
                                </Button>

                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => void executeStatusAction('draft')()}
                                    disabled={isRunningStatusAction || categories.length === 0}
                                >
                                    Pasar a borrador
                                </Button>

                                <div className="space-y-2 rounded-md border p-3">
                                    <Label htmlFor="scheduleOnlyDate" className="inline-flex items-center gap-2">
                                        <CalendarClock size={14} />
                                        Programar publicación
                                    </Label>
                                    <Input
                                        id="scheduleOnlyDate"
                                        type="date"
                                        lang="es-ES"
                                        value={scheduledForValue || ''}
                                        onChange={(event) => setValue('scheduledFor', event.target.value, { shouldDirty: true })}
                                    />
                                    <Button
                                        className="w-full"
                                        variant="secondary"
                                        onClick={() => void executeStatusAction('schedule')()}
                                        disabled={isRunningStatusAction || categories.length === 0}
                                    >
                                        Programar
                                    </Button>
                                </div>

                                <Button
                                    className="w-full"
                                    variant="destructive"
                                    onClick={() => void deletePost(post.postId).then(() => navigate('/dashboard/blog'))}
                                    disabled={isDeleting}
                                >
                                    <Trash2 size={15} className="mr-2" />
                                    Eliminar post
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BlogEditorPage;
