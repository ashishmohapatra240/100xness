import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../lib/env";


const User: IUser[] = [];



export function register(req: Request, res: Response) {
    try {
        const { name, email, password } = req.body;
        const user = User.find((user) => user.email === email);
        if (user) {
            return res.status(400).json({ message: "User already exists" });
        }
        const newUser = { name, email, password, balance: { balance: 100000000, last_updated: new Date() }, orders: [], symbolQty: { btcusdt: 0, ethusdt: 0, solusdt: 0 }, id: (User.length + 1).toString() };
        User.push(newUser);
        console.log(User);
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
        res.status(201).json({ message: "User created successfully", token });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required" });
        }
        const user = User.find((user) => user.email === email);
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }
        if (user.password !== password) {
            return res.status(400).json({ message: "Invalid password" });
        }
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
        res.status(200).json({ message: "Login successful", token });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


export function logout(req: Request, res: Response) {
    return res.status(200).json({ message: "Logout successful" });
}
