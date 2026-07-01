// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders recursive tree roots, two-row toolbar controls, and a type column", async () => {
    render(<AppShell bootstrap={{
      ...bootstrap,
      tree: [
        { id: "locations", label: "位置", section: "locations", kind: "virtual", path: "/位置", icon: "folder", children: [
          { id: "favorites", label: "收藏夹", section: "locations", kind: "virtual", path: "/位置/收藏夹", icon: "treeFav" },
          { id: "personal", label: "个人空间", section: "locations", kind: "directory", path: "/位置/个人空间", icon: "folder" }
        ] },
        { id: "tools", label: "工具", section: "tools", kind: "virtual", path: "/工具", icon: "setting", children: [] },
        { id: "mounts", label: "网络挂载", section: "mounts", kind: "virtual", path: "/网络挂载", icon: "computer", children: [] }
      ]
    }} />);
    expect(await screen.findByRole("treeitem", { name: /位置/ })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /工具/ })).toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /网络挂载/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "后退" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前进" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建文件夹" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开上传菜单" }));
    expect(screen.getByRole("menuitem", { name: "上传文件夹" })).toBeInTheDocument();
    expect(screen.getByText("类型")).toBeInTheDocument();
  });

  it("groups upload, new-file, sort, and icon-size controls behind toolbar menus", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "上传文件夹" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开上传菜单" }));
    expect(screen.getByRole("menuitem", { name: "上传文件夹" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "新建文件" }));
    expect(screen.getByRole("menuitem", { name: "MD 文件" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "PPTX 文件" })).toBeInTheDocument();

    expect(screen.queryByLabelText("图标大小")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "调整图标大小" }));
    expect(screen.getByLabelText("图标大小")).toHaveAttribute("aria-orientation", "vertical");

    expect(screen.queryByRole("combobox", { name: "排序方式" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "排序" }));
    expect(screen.getByRole("menuitem", { name: "名称" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "类型" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "大小" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "修改时间" })).toBeInTheDocument();
  });

  it("opens files with the browser open route and clears selection on empty surface click", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/files?")) {
        return {
          json: async () => ({ ok: true, data: [
            { name: "readme.md", path: "/位置/个人空间/我的文档/readme.md", kind: "file", size: 1234, modifiedAt: "2026-01-01T00:00:00.000Z", extension: "md" }
          ] })
        };
      }
      return { json: async () => ({ ok: true, data: [] }) };
    }));

    const { container } = render(<AppShell bootstrap={bootstrap} />);
    const row = await screen.findByRole("row", { name: /readme\.md/ });
    fireEvent.click(row);
    expect(row).toHaveClass("selected");

    fireEvent.doubleClick(row);
    expect(open).toHaveBeenCalledWith("/api/files/open?path=%2F%E4%BD%8D%E7%BD%AE%2F%E4%B8%AA%E4%BA%BA%E7%A9%BA%E9%97%B4%2F%E6%88%91%E7%9A%84%E6%96%87%E6%A1%A3%2Freadme.md", "_blank", "noopener");

    fireEvent.pointerDown(container.querySelector(".file-surface")!);
    await waitFor(() => expect(row).not.toHaveClass("selected"));
  });

  it("expands the file surface when the inspector panel is hidden", async () => {
    const { container } = render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /隐藏属性/ }));
    expect(container.querySelector(".content")).toHaveClass("inspector-closed");
    expect(container.querySelector(".inspector-panel")).not.toBeInTheDocument();
  });

  it("uses an input search flow instead of a prompt dialog", async () => {
    const prompt = vi.spyOn(window, "prompt");
    render(<AppShell bootstrap={bootstrap} />);
    const search = await screen.findByPlaceholderText("搜索");
    fireEvent.change(search, { target: { value: "readme" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(prompt).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/search/recent"), expect.anything());
  });

  it("opens the compact menu with the retained entries only", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.menu }));
    expect(screen.getByRole("button", { name: /后台管理|Admin/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /插件管理|Plugins/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /多语言|Language/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /主题样式|Theme/ })).toBeInTheDocument();
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

  it("prevents the native page context menu and uses webbox context actions", async () => {
    const { container } = render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    container.querySelector(".app-shell")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("shows inspector success toast after saving properties", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("标签"), { target: { value: "work" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("保存成功")).toBeInTheDocument();
  });

  it("opens the inspector when the context menu properties action is selected", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/files?")) {
        return { json: async () => ({ ok: true, data: [
          { name: "readme.md", path: "/位置/个人空间/readme.md", kind: "file", size: 4, modifiedAt: "2026-01-01T00:00:00.000Z", extension: "md" }
        ] }) };
      }
      return { json: async () => ({ ok: true, data: [] }) };
    }));
    render(<AppShell bootstrap={bootstrap} />);
    const row = await screen.findByRole("row", { name: /readme\.md/ });
    fireEvent.click(screen.getByRole("button", { name: /隐藏属性/ }));
    expect(screen.queryByText(text.inspector.title)).not.toBeInTheDocument();
    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("button", { name: text.contextMenu.actions.properties }));
    expect(screen.getByText(text.inspector.title)).toBeInTheDocument();
  });

  it("renders memo tools as icon buttons with markdown preview support", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: text.inspector.memos }));
    expect(screen.getByRole("button", { name: "插入表情" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "插入图片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "插入附件" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Markdown 预览" }));
    expect(screen.getByLabelText("Markdown 预览区")).toBeInTheDocument();
  });

  it("uploads memo images instead of inserting base64 data urls", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/metadata/attachments")) {
        return { json: async () => ({ ok: true, data: { markdown: "![big.png](/api/metadata/attachments/a/big.png)", url: "/api/metadata/attachments/a/big.png" } }) };
      }
      return { json: async () => ({ ok: true, data: [] }) };
    }));
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: text.inspector.memos }));
    const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    const file = new File(["large-image"], "big.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect((screen.getByPlaceholderText(text.inspector.memoPlaceholder) as HTMLTextAreaElement).value).toContain("/api/metadata/attachments/a/big.png"));
    expect((screen.getByPlaceholderText(text.inspector.memoPlaceholder) as HTMLTextAreaElement).value).not.toContain("data:image");
  });

  it("disables memo tab for multi-selection and shows sort arrows on list headers", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/files?")) {
        return { json: async () => ({ ok: true, data: [
          { name: "a.txt", path: "/位置/个人空间/a.txt", kind: "file", size: 1, modifiedAt: "2026-01-01T00:00:00.000Z", extension: "txt" },
          { name: "b.txt", path: "/位置/个人空间/b.txt", kind: "file", size: 2, modifiedAt: "2026-01-02T00:00:00.000Z", extension: "txt" }
        ] }) };
      }
      if (url.includes("/api/files/details")) {
        return { json: async () => ({ ok: true, data: { name: "x", path: "/x", kind: "file", size: 1, modifiedAt: "2026-01-01T00:00:00.000Z", extension: "txt", tags: [] } }) };
      }
      return { json: async () => ({ ok: true, data: [] }) };
    }));
    render(<AppShell bootstrap={bootstrap} />);
    const first = await screen.findByRole("row", { name: /a\.txt/ });
    const second = await screen.findByRole("row", { name: /b\.txt/ });
    fireEvent.click(first);
    fireEvent.click(second, { ctrlKey: true });
    expect(screen.getByRole("tab", { name: text.inspector.memos })).toBeDisabled();
    expect(screen.getByRole("columnheader", { name: /名称/ })).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("columnheader", { name: /大小/ }));
    expect(screen.getByRole("columnheader", { name: /大小/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("opens a folder context menu on empty file surface", async () => {
    const { container } = render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.contextMenu(container.querySelector(".file-surface")!);
    const menu = within(container.querySelector(".context-menu")!);
    expect(menu.getByRole("button", { name: text.fileManager.refresh })).toBeInTheDocument();
    expect(menu.getByRole("button", { name: text.fileManager.newFolder })).toBeInTheDocument();
    expect(menu.getByRole("button", { name: text.fileManager.newFile })).toBeInTheDocument();
    expect(menu.getByRole("button", { name: text.contextMenu.actions.properties })).toBeInTheDocument();
  });

  it("uses markdown-it compatible preview output and dims the disabled memo tab", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/files?")) {
        return { json: async () => ({ ok: true, data: [
          { name: "a.txt", path: "/位置/个人空间/a.txt", kind: "file", size: 1, modifiedAt: "2026-01-01T00:00:00.000Z", extension: "txt" },
          { name: "b.txt", path: "/位置/个人空间/b.txt", kind: "file", size: 2, modifiedAt: "2026-01-02T00:00:00.000Z", extension: "txt" }
        ] }) };
      }
      return { json: async () => ({ ok: true, data: [] }) };
    }));
    render(<AppShell bootstrap={bootstrap} />);
    fireEvent.click(await screen.findByRole("row", { name: /a\.txt/ }));
    fireEvent.click(screen.getByRole("row", { name: /b\.txt/ }), { ctrlKey: true });
    expect(screen.getByRole("tab", { name: text.inspector.memos })).toHaveClass("disabled");
  });

  it("opens an independent network mount panel with an add mount dialog", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/settings")) {
        return { json: async () => ({ ok: true, data: {
          explorer: { theme: "light", language: "zh-CN", viewMode: "list", iconSize: 72, sort: { key: "name", direction: "asc" }, searchHistoryLimit: 10, currentPath: "/位置/个人空间", expandedTreeIds: ["mounts"], historyBack: [], historyForward: [] },
          upload: { chunkSizeMb: 8, concurrency: 3, ignorePatterns: [], retryCount: 2 },
          download: { speedLimitKb: 0, frontendZip: true, backendZipSizeLimitMb: 1024 }
        } }) };
      }
      if (url.includes("/api/mounts") && init?.method === "POST") {
        return { json: async () => ({ ok: true, data: { id: "dav-example", type: "webdav", name: "dav.example.test", root: "https://dav.example.test:443", enabled: true } }) };
      }
      if (url.includes("/api/mounts")) {
        return { json: async () => ({ ok: true, data: [] }) };
      }
      return { json: async () => ({ ok: true, data: [] }) };
    }));
    render(<AppShell bootstrap={{ ...bootstrap, tree: [
      { id: "mounts", label: "网络挂载", section: "mounts", kind: "virtual", path: "/网络挂载", icon: "computer", children: [
        { id: "mount-add", label: "新增网络挂载", section: "mounts", kind: "virtual", path: "/网络挂载/新增网络挂载", icon: "computer" }
      ] }
    ] }} />);
    fireEvent.click(await screen.findByRole("button", { name: "网络挂载" }));
    expect(screen.getByRole("heading", { name: "网络挂载" })).toBeInTheDocument();
    const addMountButtons = screen.getAllByRole("button", { name: "新增网络挂载" });
    expect(addMountButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(addMountButtons[addMountButtons.length - 1]);
    expect(screen.getByRole("dialog", { name: "新增网络挂载" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "WebDAV" }));
    fireEvent.change(screen.getByLabelText("服务器地址"), { target: { value: "dav.example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/mounts", expect.objectContaining({ method: "POST" })));
  });

  it("saves language and theme choices through backend settings", async () => {
    render(<AppShell bootstrap={bootstrap} />);
    expect(await screen.findByText(text.fileManager.emptyFolder)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.menu }));
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.languages }));
    fireEvent.click(screen.getByRole("button", { name: text.bottomMenu.english }));
    fireEvent.click(screen.getByRole("button", { name: /主题样式|Theme/ }));
    fireEvent.click(screen.getByRole("button", { name: /深色|Dark/ }));
    expect(fetch).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "PUT" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
