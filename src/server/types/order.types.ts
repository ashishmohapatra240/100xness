export interface IGetOrdersQuery {
    page: number;
    limit: number;
    status: "open" | "close";
}