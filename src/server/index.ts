import express, { Request, Response } from "express";
import cookieParser from 'cookie-parser';
import authRouter from "./routes/auth.route";
import candlesRouter from "./routes/candles.route";
import orderRouter from "./routes/order.route";
import { schema } from "../lib/db";
import cors from "cors";

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req: Request, res: Response) => {
    res.send("100xness");
});

app.use("/auth", authRouter);
app.use("/candles", candlesRouter);
app.use("/trades", orderRouter);

const port = Number(process.env.PORT) || 3000;

async function startServer() {
    try {
        console.log("Initializing database schema...");
        await schema();
        console.log("Database schema initialized successfully");

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error("Failed to initialize database schema:", error);
        process.exit(1);
    }
}

startServer();
