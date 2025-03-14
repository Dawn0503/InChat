import { defineConfig } from "umi";

interface IRoute {
  path: string;
  component?: string;
  wrappers?: string[];
  redirect?: string;
  exact?: boolean;
  routes?: IRoute[];
  title?: string;
  icon?: string;
  name?: string;
  access?: string;
}

export default defineConfig({
  routes: [
    { path: "/", redirect: "/login" },
    { path: "/login", component: "@/pages/login/login" },
    { path: "/chat", component: "@/pages/chat/chat" },
    { path: "/friends/addFriend", component: "@/pages/friends/addFriend" },
  ],

  npmClient: "pnpm",
  tailwindcss: {},
  plugins: ["@umijs/plugins/dist/tailwindcss"],
});
