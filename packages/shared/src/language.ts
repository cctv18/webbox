export const zhCN = {
  app: {
    loadFailed: "加载失败",
    loading: "加载中"
  },
  fileManager: {
    treeLabel: "目录树",
    personalFiles: "个人文件",
    locations: "位置",
    favorites: "收藏夹",
    personalSpace: "个人空间",
    tools: "工具",
    recentDocuments: "最近文档",
    photos: "我的相册",
    documents: "我的文档",
    music: "我的音乐",
    videos: "我的视频",
    safeBox: "私密保险箱",
    mounts: "网络挂载",
    localMounts: "本地磁盘",
    recycleBin: "回收站",
    refresh: "刷新",
    upload: "上传",
    newFile: "新建文件",
    newFolder: "新建文件夹",
    search: "搜索",
    gridView: "网格视图",
    listView: "列表视图",
    fileList: "文件列表",
    name: "名称",
    size: "大小",
    type: "类型",
    createdTime: "创建时间",
    accessedTime: "访问时间",
    modifiedTime: "修改时间",
    emptyFolder: "此文件夹为空",
    directorySize: "-",
    emptyHint: "拖入文件或使用上方按钮开始管理个人文件",
    selectedCount: "已选择",
    uploadDone: "上传完成",
    operationDone: "操作完成"
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
    noticeDescription: "站内消息会通过左下角通知入口展示。",
    storage: {
      personal: "个人空间目录",
      photos: "我的相册目录",
      documents: "我的文档目录",
      music: "我的音乐目录",
      videos: "我的视频目录",
      safeBox: "私密保险箱目录",
      recycle: "回收站目录",
      save: "保存目录配置",
      targetNotEmpty: "目标目录存在文件，请手工清理"
    }
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
      recycle: "删除到回收站",
      restore: "恢复",
      deleteForever: "彻底删除",
      archive: "压缩/解压",
      favorite: "收藏",
      unfavorite: "取消收藏",
      properties: "属性"
    }
  },
  inspector: {
    title: "信息",
    properties: "属性",
    memos: "备忘录",
    activity: "动态",
    description: "标签说明",
    tags: "标签",
    save: "保存",
    memoPlaceholder: "输入文本、emoji 或 Markdown 备忘录",
    addMemo: "添加备忘录",
    noActivity: "暂无动态",
    noSelection: "未选中文件时显示当前目录信息"
  },
  safeBox: {
    setupTitle: "设置私密保险箱密码",
    loginTitle: "解锁私密保险箱",
    password: "密码",
    oldPassword: "旧密码",
    newPassword: "新密码",
    open: "开启",
    unlock: "解锁",
    logout: "退出保险箱",
    changePassword: "修改密码",
    notOpen: "私密保险箱尚未开启",
    locked: "请先解锁私密保险箱",
    unlocked: "私密保险箱已解锁",
    loginFailed: "密码错误"
  },
  notifications: {
    title: "站内通知",
    empty: "暂无通知",
    markRead: "标记已读",
    clear: "清空通知"
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
      targetNotEmpty: "目标目录存在文件，请手工清理",
      safeBoxLocked: "请先解锁私密保险箱",
      routeNotFound: "路由不存在"
    },
    logs: {
      requestStart: "请求开始",
      requestComplete: "请求完成",
      requestFailed: "请求失败",
      serverStart: "服务已启动",
      bootstrap: "加载初始化数据",
      plugins: "加载插件",
      fileOperationFailed: "文件操作失败",
      activity: "记录动态",
      notification: "写入通知",
      watcher: "文件监听"
    }
  }
} as const;

export type WebboxLanguage = typeof zhCN;
