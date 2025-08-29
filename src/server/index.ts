import express, { Request, Response } from "express";
import authRouter from "./routes/auth.route";
import candlesRouter from "./routes/candles.route";
import orderRouter from "./routes/order.route";

const app = express();


app.use(express.json());

app.get("/", (req: Request, res: Response) => {
    res.send("100xness");
});

app.use("/auth", authRouter);
app.use("/candles", candlesRouter);
app.use("/trades", orderRouter);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
