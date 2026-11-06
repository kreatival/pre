"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const catalog_json_1 = __importDefault(require("../../data/catalog.json"));
exports.catalogRouter = (0, express_1.Router)();
exports.catalogRouter.get("/", (_req, res) => {
    res.json(catalog_json_1.default);
});
