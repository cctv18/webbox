export const zhCN = {
  app: {
    loadFailed: "加载失败",
    loading: "加载中"
  },
  fileManager: {
    treeLabel: "目录树",
    personalFiles: "个人文件",
    recycleBin: "回收站",
    refresh: "刷新",
    upload: "上传",
    newFile: "新建文件",
    newFolder: "新建文件夹",
    search: "搜索",
    gridView: "网格视图",
    fileList: "文件列表",
    name: "名称",
    size: "大小",
    modifiedTime: "修改时间",
    emptyFolder: "此文件夹为空",
    directorySize: "-",
    emptyHint: "拖入文件或使用上方按钮开始管理个人文件"
  },
  bottomMenu: {
    notificationTitle: "站内消息通知",
    openMenuTitle: "打开菜单",
    notifications: "通知",
    menu: "菜单",
    admin: "后台管理",
    plugins: "插件管理",
    languages: "多语言",
    simplifiedChinese: "简体中文",
    english: "English",
    theme: "主题样式",
    themeSystem: "跟随系统",
    themeLight: "浅色",
    themeDark: "深色"
  },
  admin: {
    panelLabel: "后台管理面板",
    title: "后台管理",
    close: "关闭",
    navLabel: "后台管理",
    tabs: {
      overview: "概览",
      settings: "系统设置",
      storage: "存储/文件",
      plugins: "插件管理",
      notice: "通知管理"
    },
    overviewStorage: "存储使用：等待服务端统计",
    overviewStatus: "运行状态：Webbox 本地服务",
    settingsDescription: "语言、主题、上传限制和编辑器行为由 Webbox 设置管理。",
    storageDescription: "个人文件根目录、回收站维护和缩略图选项。",
    pluginCoreCompatible: "核心兼容",
    noPlugins: "未发现核心插件",
    noticeDescription: "站内消息会通过左下角通知入口展示。"
  },
  contextMenu: {
    label: "文件操作菜单",
    actions: {
      open: "打开",
      preview: "预览",
      download: "下载",
      rename: "重命名",
      copy: "复制",
      move: "移动",
      delete: "删除",
      archive: "压缩/解压",
      properties: "属性"
    }
  },
  pluginViewer: {
    title: "文件预览",
    builtinPreview: "内置预览"
  },
  server: {
    fallbackHtml: "Webbox 服务已启动。构建前端后即可使用界面。",
    errors: {
      operationFailed: "操作失败",
      pathOutsideRoot: "路径超出文件根目录",
      invalidInput: "输入无效",
      pathNotFound: "路径不存在",
      duplicateName: "目标已存在",
      routeNotFound: "路由不存在"
    },
    logs: {
      requestStart: "请求开始",
      requestComplete: "请求完成",
      requestFailed: "请求失败",
      serverStart: "服务已启动",
      bootstrap: "加载初始化数据",
      plugins: "加载插件",
      fileOperationFailed: "文件操作失败"
    }
  }
} as const;

export type WebboxLanguage = typeof zhCN;
