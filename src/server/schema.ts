interface IUser {
    id: String;
    name: String;
    email: String;
    password: String;
    balance: IBalance;
    symbolQty: {
        [key in SymbolTrade]: number;
    };
    orders: IOrder[];
}


interface IBalance {
    balance: number;
    last_updated: Date;
}

type OrderType = "buy" | "sell";
type OrderStatus = "pending" | "filled" | "cancelled";
type SymbolTrade = "btcusdt" | "ethusdt" | "solusdt";


interface IOrder {
    id: String;
    symbol: SymbolTrade;
    quantity: number;
    price: number;
    type: OrderType;
    status: OrderStatus;
    created_at: Date;
    updated_at: Date;
}