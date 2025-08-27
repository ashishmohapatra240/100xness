import express, { Request, Response } from "express";
import authRouter from "./routes/auth.route";

const app = express();


app.use(express.json());

app.get("/", (req: Request, res: Response) => {
    res.send("100xness");
});

app.use("/auth", authRouter);
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
