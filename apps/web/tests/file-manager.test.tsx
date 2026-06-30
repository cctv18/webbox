// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { zhCN } from "@webbox/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../src/App";

const text = zhCN;

const bootstrap = {
  user: { id: "local", name: "Local User", isAdmin: true, permissions: ["*"] },
  features: { login: false, users: false, share: false, desktop: false, history: false },
  theme: "system",
  language: "zh-CN",
  plugins: []
} as const;

describe("Webbox UI", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      json: async () => ({ ok: true, data: [] })
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the file manager and compact bottom menu", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Webbox" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.bottomMenu.notifications })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.bottomMenu.menu })).toBeInTheDocument();
    expect(screen.queryByText("企业网盘")).not.toBeInTheDocument();
    expect(screen.queryByText("我在的部门")).not.toBeInTheDocument();
    expect(screen.queryByText("与我协作")).not.toBeInTheDocument();
    expect(screen.queryByText("外链分享")).not.toBeInTheDocument();
    expect(screen.queryByText("桌面")).not.toBeInTheDocument();
  });

  it("opens the compact menu with the retained entries only", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.menu }));
    expect(screen.getByRole("button", { name: text.bottomMenu.admin })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.bottomMenu.plugins })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.bottomMenu.languages })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.bottomMenu.theme })).toBeInTheDocument();
  });

  it("does not render removed admin sections", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.menu }));
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.admin }));
    expect(screen.queryByText("部门与成员管理")).not.toBeInTheDocument();
    expect(screen.queryByText("登录日志")).not.toBeInTheDocument();
    expect(screen.queryByText("客户端及App")).not.toBeInTheDocument();
    expect(screen.queryByText("分享管理")).not.toBeInTheDocument();
    expect(screen.queryByText("Apache")).not.toBeInTheDocument();
    expect(screen.queryByText("Nginx")).not.toBeInTheDocument();
    expect(screen.queryByText("PHP")).not.toBeInTheDocument();
    expect(screen.queryByText("数据库")).not.toBeInTheDocument();
  });

  it("does not render removed context menu actions", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    expect(screen.queryByText("编辑锁定")).not.toBeInTheDocument();
    expect(screen.queryByText("快速外链分享")).not.toBeInTheDocument();
    expect(screen.queryByText("创建快捷方式")).not.toBeInTheDocument();
    expect(screen.queryByText("发送到桌面快捷方式")).not.toBeInTheDocument();
  });
});
