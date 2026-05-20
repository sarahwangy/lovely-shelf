import Anthropic from "@anthropic-ai/sdk";

// 全项目共用一个 Anthropic client 实例，避免每个文件各自初始化
// 行业惯例：SDK client 是线程安全的，单例即可
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
