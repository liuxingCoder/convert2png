const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sharp = require("sharp");

// 创建窗口
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 加载 HTML 文件
  win.loadFile("index.html");
}

// 当 Electron 初始化完成后调用
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 关闭应用
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// 处理图片转换请求
ipcMain.on("convert-image", async (event, fileBuffer, fileName) => {
  try {
    const finalBuffer = await sharp(fileBuffer)
      .ensureAlpha() // 添加 Alpha 透明通道
      .toColorspace("srgb") // 确保颜色空间正确
      .raw() // 获取原始 RGBA 数据
      .toBuffer({ resolveWithObject: true });

    const { data, info } = finalBuffer;

    // 遍历所有像素，将白色像素 (≈255,255,255) 变为透明
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // 设置 Alpha 通道为 0（透明）
      }
    }

    // 重新生成 PNG
    const transparentBuffer = await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    })
      .toFormat("png")
      .toBuffer();

    // 直接返回 PNG buffer，不写入文件
    event.reply("conversion-success", transparentBuffer, fileName);
  } catch (err) {
    event.reply("conversion-failed", err.message);
  }
});
