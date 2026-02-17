import { PaginationMeta } from "./types.js";

export class PaginationService {
  public generateMeta({
    page,
    perPage,
    count,
  }: {
    page: number;
    perPage: number;
    count: number;
  }): PaginationMeta {
    const hasNext = count > perPage * page;
    const hasPrevious = page > 1;

    return {
      hasNext,
      hasPrevious,
      page,
      perPage,
      total: count,
    };
  }
}
