import { Router } from "express";
import { getUser, login, logout, register } from "../controller/auth.controller";
import { authenticate } from "../middleware/authenticate";

const router: Router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/me", authenticate, getUser);
router.post("/logout", logout);

export default router;