import { Router } from "express";
import catalog from "../../data/catalog.json";

export const catalogRouter = Router();
catalogRouter.get("/", (_req, res) => {
  res.json(catalog);
});
