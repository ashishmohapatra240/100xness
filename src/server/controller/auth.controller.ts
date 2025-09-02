import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../lib/env";
import { prisma } from "../../lib/config";

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "name, email and password are required" });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ message: "User already exists" });
        }

        const newUser = await prisma.user.create({
            data: { name, email, password, balance: { create: {} } }
        });

        const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: "1d" });

        res.cookie("auth_token", token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });

        res.status(201).json({ message: "User created successfully", user: { id: newUser.id, email: newUser.email } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(password === user.password)) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1d" });

        res.cookie("auth_token", token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
        });

        console.log(`[auth] User ${user.email} logged in successfully, token set in cookie`);
        res.status(200).json({
            message: "Login successful",
            user: { id: user.id, email: user.email }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


export const getUser = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, email: true, name: true, balance: true }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const logout = async (req: Request, res: Response) => {
    try {
        res.clearCookie("auth_token");
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
