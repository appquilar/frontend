import {
    BlogCategory,
    BlogPost,
    BlogPostListResult,
    BlogPostStatus,
    CreateBlogCategoryData,
    CreateBlogPostData,
    UpdateBlogPostData,
} from '@/domain/models/BlogPost';
import {
    AdminBlogPostListParams,
    BlogPostListParams,
    BlogRepository,
} from '@/domain/repositories/BlogRepository';
import { ApiClient } from '@/infrastructure/http/ApiClient';
import { AuthSession } from '@/domain/models/AuthSession';

export class ApiBlogRepository implements BlogRepository {
    constructor(
        private readonly client: ApiClient,
        private readonly getSession: () => AuthSession | null
    ) {}

    private authHeaders(): Record<string, string> {
        const token = this.getSession()?.token;
        if (!token) {
            return {};
        }

        return {
            Authorization: `Bearer ${token}`,
        };
    }

    async listPublicPosts(params: BlogPostListParams = {}): Promise<BlogPostListResult> {
        const query = new URLSearchParams();

        if (params.page) query.set('page', String(params.page));
        if (params.perPage) query.set('per_page', String(params.perPage));
        if (params.text) query.set('text', params.text);

        const response = await this.client.get<unknown>(`/api/blog/posts${query.toString() ? `?${query.toString()}` : ''}`);

        return this.mapListResponse(response);
    }

    async getPublicPostBySlug(slug: string): Promise<BlogPost | null> {
        try {
            const response = await this.client.get<unknown>(`/api/blog/posts/${slug}`);
            return this.extractSingle(response);
        } catch {
            return null;
        }
    }

    async listAdminPosts(params: AdminBlogPostListParams = {}): Promise<BlogPostListResult> {
        const query = new URLSearchParams();

        if (params.page) query.set('page', String(params.page));
        if (params.perPage) query.set('per_page', String(params.perPage));
        if (params.text) query.set('text', params.text);
        if (params.status) query.set('status', params.status);

        const response = await this.client.get<unknown>(
            `/api/admin/blog/posts${query.toString() ? `?${query.toString()}` : ''}`,
            { headers: this.authHeaders() }
        );

        return this.mapListResponse(response);
    }

    async getAdminPostById(postId: string): Promise<BlogPost | null> {
        try {
            const response = await this.client.get<unknown>(`/api/admin/blog/posts/${postId}`, {
                headers: this.authHeaders(),
            });

            return this.extractSingle(response);
        } catch {
            return null;
        }
    }

    async createPost(data: CreateBlogPostData): Promise<void> {
        await this.client.post(
            '/api/admin/blog/posts',
            {
                post_id: data.postId,
                category_id: data.categoryId,
                title: data.title,
                body: data.body,
                excerpt: data.excerpt,
                keywords: data.keywords ?? [],
                header_image_id: data.headerImageId ?? null,
                hero_image_id: data.heroImageId ?? null,
                status: data.status ?? 'draft',
                scheduled_for: data.scheduledFor ?? null,
            },
            {
                headers: this.authHeaders(),
                skipParseJson: true,
            }
        );
    }

    async updatePost(postId: string, data: UpdateBlogPostData): Promise<void> {
        await this.client.patch(
            `/api/admin/blog/posts/${postId}`,
            {
                category_id: data.categoryId,
                title: data.title,
                body: data.body,
                excerpt: data.excerpt,
                keywords: data.keywords,
                header_image_id: data.headerImageId ?? null,
                hero_image_id: data.heroImageId ?? null,
            },
            {
                headers: this.authHeaders(),
                skipParseJson: true,
            }
        );
    }

    async deletePost(postId: string): Promise<void> {
        await this.client.delete(`/api/admin/blog/posts/${postId}`, undefined, {
            headers: this.authHeaders(),
            skipParseJson: true,
        });
    }

    async publishPost(postId: string): Promise<void> {
        await this.client.patch(
            `/api/admin/blog/posts/${postId}/publish`,
            {},
            {
                headers: this.authHeaders(),
                skipParseJson: true,
            }
        );
    }

    async draftPost(postId: string): Promise<void> {
        await this.client.patch(
            `/api/admin/blog/posts/${postId}/draft`,
            {},
            {
                headers: this.authHeaders(),
                skipParseJson: true,
            }
        );
    }

    async schedulePost(postId: string, scheduledFor: string): Promise<void> {
        await this.client.patch(
            `/api/admin/blog/posts/${postId}/schedule`,
            { scheduled_for: scheduledFor },
            {
                headers: this.authHeaders(),
                skipParseJson: true,
            }
        );
    }

    async listCategories(): Promise<BlogCategory[]> {
        const response = await this.client.get<unknown>('/api/admin/blog/categories', {
            headers: this.authHeaders(),
        });

        const payload = this.unwrapPayload(response);
        const payloadData = this.pick(payload, 'data');
        const items = Array.isArray(payloadData)
            ? payloadData
            : Array.isArray(payload)
                ? payload
                : [];

        return items
            .filter((item): item is Record<string, unknown> => this.isRecord(item))
            .map((item) => this.mapCategory(item))
            .filter((item): item is BlogCategory => item !== null);
    }

    async createCategory(data: CreateBlogCategoryData): Promise<void> {
        await this.client.post(
            '/api/admin/blog/categories',
            {
                category_id: data.categoryId,
                name: data.name,
            },
            {
                headers: this.authHeaders(),
                skipParseJson: true,
            }
        );
    }

    async deleteCategory(categoryId: string): Promise<void> {
        await this.client.delete(`/api/admin/blog/categories/${categoryId}`, undefined, {
            headers: this.authHeaders(),
            skipParseJson: true,
        });
    }

    private mapListResponse(raw: unknown): BlogPostListResult {
        const rootPayload = this.isRecord(raw) ? raw : this.unwrapPayload(raw);
        const nestedPayload = this.pick(rootPayload, 'data');
        const payload = this.isRecord(nestedPayload) ? nestedPayload : rootPayload;
        const payloadData = this.pick(payload, 'data');

        const items = Array.isArray(payloadData)
            ? payloadData
            : Array.isArray(payload)
                ? payload
                : [];

        return {
            data: items
                .filter((item): item is Record<string, unknown> => this.isRecord(item))
                .map((item) => this.mapToDomain(item)),
            total: Number(this.pick(payload, 'total') ?? items.length),
            page: Number(this.pick(payload, 'page') ?? 1),
        };
    }

    private extractSingle(raw: unknown): BlogPost | null {
        const payload = this.unwrapPayload(raw);
        if (!this.isRecord(payload)) {
            return null;
        }

        return this.mapToDomain(payload);
    }

    private mapToDomain(item: Record<string, unknown>): BlogPost {
        const statusRaw = this.stringOrNull(this.pick(item, 'status')) ?? 'draft';
        const status: BlogPostStatus =
            statusRaw === 'scheduled' || statusRaw === 'published' || statusRaw === 'draft'
                ? statusRaw
                : 'draft';

        const googlePreviewRaw = this.pick(item, 'google_preview');
        const googlePreview = this.isRecord(googlePreviewRaw) ? googlePreviewRaw : {};
        const category = this.mapCategory(this.pick(item, 'category'));
        const keywords = this.stringArray(this.pick(item, 'keywords'));

        return {
            postId: this.stringOrNull(this.pick(item, 'post_id')) ?? '',
            title: this.stringOrNull(this.pick(item, 'title')) ?? '',
            slug: this.stringOrNull(this.pick(item, 'slug')) ?? '',
            body: this.stringOrNull(this.pick(item, 'body')),
            excerpt: this.stringOrNull(this.pick(item, 'excerpt')) ?? '',
            keywords,
            category,
            headerImageId: this.stringOrNull(this.pick(item, 'header_image_id')),
            heroImageId: this.stringOrNull(this.pick(item, 'hero_image_id')),
            status,
            scheduledFor: this.stringOrNull(this.pick(item, 'scheduled_for')),
            publishedAt: this.stringOrNull(this.pick(item, 'published_at')),
            createdAt: this.stringOrNull(this.pick(item, 'created_at')) ?? '',
            updatedAt: this.stringOrNull(this.pick(item, 'updated_at')),
            googlePreview: {
                title: this.stringOrNull(this.pick(googlePreview, 'title')) ?? (this.stringOrNull(this.pick(item, 'title')) ?? ''),
                slug: this.stringOrNull(this.pick(googlePreview, 'slug')) ?? `/blog/${this.stringOrNull(this.pick(item, 'slug')) ?? ''}`,
                description: this.stringOrNull(this.pick(googlePreview, 'description')) ?? (this.stringOrNull(this.pick(item, 'excerpt')) ?? ''),
            },
        };
    }

    private mapCategory(raw: unknown): BlogCategory | null {
        if (!this.isRecord(raw)) {
            return null;
        }

        const categoryId = this.stringOrNull(this.pick(raw, 'category_id'));
        const name = this.stringOrNull(this.pick(raw, 'name'));
        const slug = this.stringOrNull(this.pick(raw, 'slug'));

        if (!categoryId || !name || !slug) {
            return null;
        }

        return {
            categoryId,
            name,
            slug,
        };
    }

    private unwrapPayload(raw: unknown): unknown {
        if (!this.isRecord(raw)) {
            return raw;
        }

        if (this.pick(raw, 'success') !== undefined && this.pick(raw, 'data') !== undefined) {
            return this.pick(raw, 'data');
        }

        return raw;
    }

    private pick(record: unknown, key: string): unknown {
        if (!this.isRecord(record)) {
            return undefined;
        }

        return record[key];
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private stringOrNull(value: unknown): string | null {
        if (typeof value === 'string') {
            return value;
        }

        return null;
    }

    private stringArray(raw: unknown): string[] {
        if (!Array.isArray(raw)) {
            return [];
        }

        return raw.filter((value): value is string => typeof value === 'string');
    }
}
