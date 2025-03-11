import { defineConfig } from "umi";

export default defineConfig({
  routes: [
    { path: "/", component: "@/pages/index" },
    { path: "/docs", component: "@/pages/docs" },
  ],
  npmClient: 'pnpm',
});
