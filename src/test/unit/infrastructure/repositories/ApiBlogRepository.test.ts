import { describe, expect, it, vi } from "vitest";

import { createAuthSession } from "@/domain/models/AuthSession";
import { ApiBlogRepository } from "@/infrastructure/repositories/ApiBlogRepository";

const createApiClientMock = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

describe("ApiBlogRepository", () => {
  it("preserves pagination metadata from the flat public API response", async () => {
    const apiClient = createApiClientMock();
    apiClient.get.mockResolvedValue({
      total: 12,
      page: 1,
      data: [
        {
          post_id: "post-1",
          title: "Public post",
          slug: "public-post",
          excerpt: "Resumen",
          status: "published",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const repository = new ApiBlogRepository(apiClient as never, () => null);

    const result = await repository.listPublicPosts({ page: 1, perPage: 10 });

    expect(result.total).toBe(12);
    expect(result.page).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it("maps public post lists with query params and google preview fallbacks", async () => {
    const apiClient = createApiClientMock();
    apiClient.get.mockResolvedValue({
      success: true,
      data: {
        data: [
          {
            post_id: "post-1",
            title: "Lanzamiento",
            slug: "lanzamiento",
            body: "Contenido",
            excerpt: "Resumen",
            keywords: ["marketplace", 123, "alquiler"],
            status: "scheduled",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            published_at: "2026-01-03T00:00:00Z",
            scheduled_for: "2026-01-10T00:00:00Z",
            category: {
              category_id: "cat-1",
              name: "Noticias",
              slug: "noticias",
            },
            google_preview: {
              title: "Preview title",
            },
          },
          {
            post_id: "post-2",
            title: "Sin categoria",
            slug: "sin-categoria",
            excerpt: "Sin categoria",
            status: "unknown",
            created_at: "2026-01-04T00:00:00Z",
            category: {
              category_id: "broken",
            },
          },
        ],
        total: 2,
        page: 2,
      },
    });

    const repository = new ApiBlogRepository(apiClient as never, () => null);

    const result = await repository.listPublicPosts({
      page: 2,
      perPage: 15,
      text: "marketplace",
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/blog/posts?page=2&per_page=15&text=marketplace"
    );
    expect(result).toEqual({
      data: [
        {
          postId: "post-1",
          title: "Lanzamiento",
          slug: "lanzamiento",
          body: "Contenido",
          excerpt: "Resumen",
          keywords: ["marketplace", "alquiler"],
          category: {
            categoryId: "cat-1",
            name: "Noticias",
            slug: "noticias",
          },
          headerImageId: null,
          heroImageId: null,
          status: "scheduled",
          scheduledFor: "2026-01-10T00:00:00Z",
          publishedAt: "2026-01-03T00:00:00Z",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          googlePreview: {
            title: "Preview title",
            slug: "/blog/lanzamiento",
            description: "Resumen",
          },
        },
        {
          postId: "post-2",
          title: "Sin categoria",
          slug: "sin-categoria",
          body: null,
          excerpt: "Sin categoria",
          keywords: [],
          category: null,
          headerImageId: null,
          heroImageId: null,
          status: "draft",
          scheduledFor: null,
          publishedAt: null,
          createdAt: "2026-01-04T00:00:00Z",
          updatedAt: null,
          googlePreview: {
            title: "Sin categoria",
            slug: "/blog/sin-categoria",
            description: "Sin categoria",
          },
        },
      ],
      total: 2,
      page: 2,
    });
  });

  it("maps admin post and category endpoints with auth headers", async () => {
    const apiClient = createApiClientMock();
    apiClient.get
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            post_id: "post-1",
            title: "Admin post",
            slug: "admin-post",
            excerpt: "Resumen",
            status: "published",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          post_id: "post-1",
          title: "Admin post",
          slug: "admin-post",
          excerpt: "Resumen",
          status: "published",
          created_at: "2026-01-01T00:00:00Z",
        },
      })
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            category_id: "cat-1",
            name: "Noticias",
            slug: "noticias",
          },
          {
            name: "broken",
          },
        ],
      });

    const repository = new ApiBlogRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );

    const list = await repository.listAdminPosts({
      page: 1,
      perPage: 10,
      text: "admin",
      status: "published",
    });
    const adminPost = await repository.getAdminPostById("post-1");
    const missingPublicPost = await repository.getPublicPostBySlug("missing-slug");
    const categories = await repository.listCategories();

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      "/api/admin/blog/posts?page=1&per_page=10&text=admin&status=published",
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      "/api/admin/blog/posts/post-1",
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
    expect(list.total).toBe(1);
    expect(adminPost?.postId).toBe("post-1");
    expect(missingPublicPost).toBeNull();
    expect(categories).toEqual([
      {
        categoryId: "cat-1",
        name: "Noticias",
        slug: "noticias",
      },
    ]);
  });

  it("serializes create, update and lifecycle mutations in snake_case", async () => {
    const apiClient = createApiClientMock();
    apiClient.post.mockResolvedValue(undefined);
    apiClient.patch.mockResolvedValue(undefined);
    apiClient.delete.mockResolvedValue(undefined);

    const repository = new ApiBlogRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );

    await repository.createPost({
      postId: "post-1",
      categoryId: "cat-1",
      title: "Nuevo",
      body: "Body",
      excerpt: "Excerpt",
      keywords: ["a", "b"],
      headerImageId: "header-1",
      heroImageId: null,
      status: "scheduled",
      scheduledFor: "2026-02-01T00:00:00Z",
    });
    await repository.updatePost("post/1", {
      categoryId: "cat-2",
      title: "Actualizado",
      body: "Body 2",
      excerpt: "Excerpt 2",
      keywords: ["x"],
      headerImageId: null,
      heroImageId: "hero-1",
    });
    await repository.deletePost("post-1");
    await repository.publishPost("post-1");
    await repository.draftPost("post-1");
    await repository.schedulePost("post-1", "2026-03-01T10:00:00Z");
    await repository.createCategory({
      categoryId: "cat-1",
      name: "Noticias",
    });
    await repository.deleteCategory("cat-1");

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/api/admin/blog/posts",
      {
        post_id: "post-1",
        category_id: "cat-1",
        title: "Nuevo",
        body: "Body",
        excerpt: "Excerpt",
        keywords: ["a", "b"],
        header_image_id: "header-1",
        hero_image_id: null,
        status: "scheduled",
        scheduled_for: "2026-02-01T00:00:00Z",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      1,
      "/api/admin/blog/posts/post/1",
      {
        category_id: "cat-2",
        title: "Actualizado",
        body: "Body 2",
        excerpt: "Excerpt 2",
        keywords: ["x"],
        header_image_id: null,
        hero_image_id: "hero-1",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/blog/posts/post-1/publish",
      {},
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      3,
      "/api/admin/blog/posts/post-1/draft",
      {},
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      4,
      "/api/admin/blog/posts/post-1/schedule",
      {
        scheduled_for: "2026-03-01T10:00:00Z",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/api/admin/blog/categories",
      {
        category_id: "cat-1",
        name: "Noticias",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.delete).toHaveBeenNthCalledWith(
      1,
      "/api/admin/blog/posts/post-1",
      undefined,
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.delete).toHaveBeenNthCalledWith(
      2,
      "/api/admin/blog/categories/cat-1",
      undefined,
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
  });
});
