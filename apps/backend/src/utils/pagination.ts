export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function getPagination(query: PaginationQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function getPaginationMeta(input: { page: number; limit: number; total: number }): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(input.total / input.limit));

  return {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPreviousPage: input.page > 1,
  };
}
