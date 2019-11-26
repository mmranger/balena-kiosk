// Modules to control application life and create native browser window
const electron = require('electron')
const { app, BrowserWindow, ipcMain, globalShortcut, session, Menu, MenuItem, powerSaveBlocker } = electron;
const path                  = require('path');
const url                   = require('url');
const childProcess = require('child_process');
// const os = require('os');
// const electronLocalShortcut = require('electron-localshortcut')

// simple parameters initialization
const electronConfig = {
  // URL_LAUNCHER_TOUCH                  : process.env.URL_LAUNCHER_TOUCH === '1' ? 1 : 0,
  // URL_LAUNCHER_TOUCH_SIMULATE         : process.env.URL_LAUNCHER_TOUCH_SIMULATE === '1' ? 1 : 0,
  // URL_LAUNCHER_FRAME                  : process.env.URL_LAUNCHER_FRAME === '1' ? 1 : 0,
  // URL_LAUNCHER_NODE                   : process.env.URL_LAUNCHER_NODE === '1' ? 1 : 0,
  // URL_LAUNCHER_TITLE                  : process.env.URL_LAUNCHER_TITLE || 'RURALKING.COM',
  // ARRAY_BAD_KB_SHORTCUTS              : process.env.ARRAY_BAD_KB_SHORTCUTS.split(',') || ['CommandOrControl+Q'],
  URL_LAUNCHER_KIOSK                  : process.env.URL_LAUNCHER_KIOSK === '0' ? true : false,
  URL_LAUNCHER_ESCAPE_HOME            : process.env.URL_LAUNCHER_ESCAPE_HOME || 'F1',
  URL_LAUNCHER_DEVTOOLS               : process.env.URL_LAUNCHER_DEVTOOLS === '0' ? true : false,
  URL_LAUNCHER_ZOOM                   : parseFloat(process.env.URL_LAUNCHER_ZOOM || 1.0),
  URL_LAUNCHER_OVERLAY_SCROLLBARS     : process.env.URL_LAUNCHER_DEVTOOLS === '0' ? true : false,
  URL_LAUNCHER_SANDBOX                : process.env.URL_LAUNCHER_SANDBOX === '1' ? true : false,
  IDLE_TIMEOUT                        : parseInt(process.env.IDLE_TIMEOUT || 300), // seconds
  MENU_WINDOW_URL                     : process.env.MENU_WINDOW_URL || `file:///${path.join(__dirname, '.', 'menu_window.html')}`,
  IDLE_CHECK                          : parseInt(process.env.IDLE_CHECK || 60000),  // 1 minute = 60,000 milliseconds
  MENU_WINDOW_WIDTH                   : parseInt(process.env.MENU_WINDOW_WIDTH || 1920, 10),
  MENU_WINDOW_HEIGHT                  : parseInt(process.env.MENU_WINDOW_HEIGHT || 110, 10),
  MENU_WINDOW_X                       : parseInt(process.env.MENU_WINDOW_X) || 0,
  MENU_WINDOW_Y                       : parseInt(process.env.MENU_WINDOW_Y) || 0,
  MENU_WINDOW_NODEINTEGRATION         : process.env.MENU_WINDOW_NODEINTEGRATION === '1' ? false : true,
  WEB_WINDOW_URL                      : process.env.WEB_WINDOW_URL || `file:///${path.join(__dirname, '.', 'web_window.html')}`,
  // WEB_WINDOW_URL                      : process.env.WEB_WINDOW_URL || `https://avena.rkdomain.net/kiosk/kiosk.html`,
  WEB_WINDOW_WIDTH                    : parseInt(process.env.WEB_WINDOW_WIDTH || 1920, 10),
  WEB_WINDOW_HEIGHT                   : parseInt(process.env.WEB_WINDOW_HEIGHT || 885, 10),
  WEB_WINDOW_X                        : parseInt(process.env.WEB_WINDOW_X) || 1,
  WEB_WINDOW_Y                        : parseInt(process.env.WEB_WINDOW_Y) || 120,
  WEB_WINDOW_NODEINTEGRATION          : process.env.WEB_WINDOW_NODEINTEGRATION === '0' ? true : false,
  WEB_WINDOW_HOME_TITLE               : process.env.WEB_WINDOW_HOME_TITLE || 'Store Kiosk',
  ARRAY_BAD_URLS                      : process.env.ARRAY_BAD_URLS.split(',') || ['facebook', 'twitter', 'youtube', 'pinterest', 'instagram', 'google.com', 'bing', 'yahoo', 'msn', 'duckduckgo'],
  POWERSAVE_START_HOUR                : parseInt(process.env.POWERSAVE_START_HOUR) || 21, // Time screen can start going dark hour in military time
  POWERSAVE_START_MINUTE              : parseInt(process.env.POWERSAVE_START_MINUTE) || 0, // Time screen can start going dark minute of the above hour
  POWERSAVE_STOP_HOUR                 : parseInt(process.env.POWERSAVE_STOP_HOUR) || 6, // Time screen stop going dark hour in military time
  POWERSAVE_STOP_MINUTE               : parseInt(process.env.POWERSAVE_STOP_MINUTE) || 0, // Time screen stop going dark minute of the above hour
};
// console.log('the uuid is: ' + BALENA_DEVICE_UUID);
// Keep a global reference of the window objects, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
const desktopIdle = require('desktop-idle');
const linux = {};
let menuWindow;
let webWindow;
let idleTimeout;
let now = new Date();
let powerBlockID = -1;
let millisTillBlockScreenTimeout = new Date(now.getFullYear(), now.getMonth(), now.getDate(), electronConfig.POWERSAVE_STOP_HOUR, electronConfig.POWERSAVE_STOP_MINUTE, 0, 0) - now;
let millisTillLetScreenTimeout = new Date(now.getFullYear(), now.getMonth(), now.getDate(), electronConfig.POWERSAVE_START_HOUR, electronConfig.POWERSAVE_START_MINUTE, 0, 0) - now;

linux.turnOff = () => {
  // Be sure to use a timeout if using  Reference: https://github.com/raythunder/electron-screen-management/blob/master/src/main.js
  childProcess.exec('export DISPLAY=:0; xset dpms force suspend');
};

linux.turnOn = () => {
  // Be sure to use a timeout if using  Reference: https://github.com/raythunder/electron-screen-management/blob/master/src/main.js
  childProcess.exec('export DISPLAY=:0; xset dpms force on');
};

function createWindows () {
  clearSession();

  if ((millisTillBlockScreenTimeout < 0 && millisTillLetScreenTimeout < 0) || (millisTillBlockScreenTimeout > 0 && millisTillLetScreenTimeout > 0)) {
    // covers time between stop and start.  both negative means after stop time,
    // before midnight. Both positive means after midnight.
    letScreenTimeout();
  } else {
    blockScreenTimeout();
  }
  if (millisTillBlockScreenTimeout < 0) {
    millisTillBlockScreenTimeout += 86400000; // it's after start-Time, try start-Time tomorrow.
  }
  if (millisTillLetScreenTimeout < 0) {
    millisTillLetScreenTimeout += 86400000; // it's after stop-Time, try stop-Time tomorrow.
  }
  setTimeout(blockScreenTimeout, millisTillBlockScreenTimeout);
  setTimeout(letScreenTimeout, millisTillLetScreenTimeout);

  globalShortcut.register('CommandOrControl+Q', () => {
    console.log('CommandOrControl+Q')
  });

  // electronConfig.ARRAY_BAD_KB_SHORTCUTS.forEach(badCmd => {
  // });
  // electronConfig.MENU_WINDOW_NODEINTEGRATION == true ? console.log('True menu window node integration') : console.log('False menu window node integration')
  // electronConfig.WEB_WINDOW_NODEINTEGRATION == true ? console.log('True web window node integration') : console.log('False web window node integration')

  globalShortcut.register(electronConfig.URL_LAUNCHER_ESCAPE_HOME, () => {
    resetBoi();
  });

  // Create the top bar menu window.
  menuWindow = new BrowserWindow({
    width         : electronConfig.MENU_WINDOW_WIDTH,
    height        : electronConfig.MENU_WINDOW_HEIGHT,
    x             : electronConfig.MENU_WINDOW_X,
    y             : electronConfig.MENU_WINDOW_Y,
    frame         : false,
    kiosk         : !!(electronConfig.URL_LAUNCHER_KIOSK),
    parent        : electronConfig.MENU_WINDOW_URL,
    webPreferences: {
      sandbox           : electronConfig.URL_LAUNCHER_SANDBOX,
      preload           : path.join(__dirname, 'preload.js'),
      nodeIntegration   : electronConfig.MENU_WINDOW_NODEINTEGRATION,
      zoomFactor        : electronConfig.URL_LAUNCHER_ZOOM,
      overlayScrollbars : !!(electronConfig.URL_LAUNCHER_OVERLAY_SCROLLBARS),
      plugins           : true,
    }
  });
  
  // Create the main kiosk window loading any webpage
  webWindow = new BrowserWindow({
    width         : electronConfig.WEB_WINDOW_WIDTH,
    height        : electronConfig.WEB_WINDOW_HEIGHT,
    x             : electronConfig.WEB_WINDOW_X,
    y             : electronConfig.WEB_WINDOW_Y,
    parent        : menuWindow,
    modal         : false,
    show          : false,
    frame         : false,
    kiosk         : !!(electronConfig.URL_LAUNCHER_KIOSK),
    webPreferences: {
      sandbox          : electronConfig.URL_LAUNCHER_SANDBOX,
      nodeIntegration  : electronConfig.WEB_WINDOW_NODEINTEGRATION,
      zoomFactor       : electronConfig.URL_LAUNCHER_ZOOM,
      overlayScrollbars: !!(electronConfig.URL_LAUNCHER_OVERLAY_SCROLLBARS),
      plugins          : true,
    },
  });

  menuWindow.loadURL(electronConfig.MENU_WINDOW_URL);
  webWindow.loadURL(electronConfig.WEB_WINDOW_URL);

  // if the env-var is set to true,
  // a portion of the screen will be dedicated to the chrome-dev-tools
  if (electronConfig.URL_LAUNCHER_DEVTOOLS) {
    menuWindow.webContents.openDevTools();
  }

  menuWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      webWindow.show();
      menuWindow.show();
    }, 120)
  });

  function checkIdleTime () {
    if (parseInt(desktopIdle.getIdleTime()) > electronConfig.IDLE_TIMEOUT && webWindow.getTitle() != electronConfig.WEB_WINDOW_HOME_TITLE) {
      // When idle longer than IDLE_TIMEOUT not on home page reload.
      resetBoi();
      stopIdleCheckInterval();
    }
    changeTimerText();
  }
  function startIdleCheckInterval () {
    changeTimerText();
    idleTimeout = setInterval(checkIdleTime, electronConfig.IDLE_CHECK); // 1 minute = 60000 milliseconds
  } 
  function stopIdleCheckInterval () {
    clearInterval(idleTimeout);
  }
  function changeTimerText () {
    let currentIdleTime = desktopIdle.getIdleTime();
    let displayIdleMinutes = Math.max(Math.ceil((electronConfig.IDLE_TIMEOUT - currentIdleTime) / 60), 1);
    if (displayIdleMinutes == 1) {
      timerText = 'Timeout in ' + pad(Math.round(electronConfig.IDLE_TIMEOUT - currentIdleTime)) + ' seconds';
    } else {
      let displayIdleSeconds = Math.round((electronConfig.IDLE_TIMEOUT - currentIdleTime)) % 60;
      if (currentIdleTime < 1) {
        displayIdleSeconds = 00;
        displayIdleMinutes += 1;
      }
      timerText = 'Timeout in ' + (displayIdleMinutes - 1) + ':' + pad(displayIdleSeconds);
    }
    menuWindow.webContents.executeJavaScript('x.innerHTML = "' + timerText + '"');
  }
  function pad(num, size) {
    var s = "0" + num;
    if (num < 10) {
      return s.substr(s.length-size);
    }
    return num;
  }
  
  function blockScreenTimeout () {
    if (!powerSaveBlocker.isStarted(powerBlockID)) {
      powerBlockID = powerSaveBlocker.start('prevent-display-sleep')
    }
    console.log('block powerSaveBlocker is active? ' + powerSaveBlocker.isStarted(powerBlockID));
    setTimeout(linux.turnOn, 1000);
  }
  function letScreenTimeout () {
    if (powerSaveBlocker.isStarted(powerBlockID)) {
      powerSaveBlocker.stop(powerBlockID);
    }
    console.log('unblock powerSaveBlocker is active? ' + powerSaveBlocker.isStarted(powerBlockID));
    setTimeout(linux.turnOff, 1000);
  }

  webWindow.webContents.on('did-finish-load', () => {
    if (webWindow.getTitle() != electronConfig.WEB_WINDOW_HOME_TITLE) {
      startIdleCheckInterval();
      menuWindow.webContents.focus();
      menuWindow.webContents.executeJavaScript('x.style.display = "inline"');
    } else {
      stopIdleCheckInterval();
      menuWindow.webContents.executeJavaScript('x.style.display = "none";');
    }
  });

  webWindow.webContents.on('new-window', (event, url, frameName, disposition, options) => {
    event.preventDefault()
    if (isNotBadUrl(url)) {
      const popupWindow = new BrowserWindow({
        webContents: options.webContents, // use existing webContents if provided
        show: false,
        frame: true,
        parent: webWindow,
        modal: true,
        alwaysOnTop: true,
        focusable: true,
        webPreferences: {
          sandbox          : electronConfig.URL_LAUNCHER_SANDBOX,
          nodeIntegration  : electronConfig.WEB_WINDOW_NODEINTEGRATION,
          zoomFactor       : electronConfig.URL_LAUNCHER_ZOOM,
          overlayScrollbars: !!(electronConfig.URL_LAUNCHER_OVERLAY_SCROLLBARS),
          plugins          : true,
        },
      });

      // console.log(options.webContents)

      const menuTemplate = [
        {
          label: 'File',
          submenu: [
            {
              label: 'Close',
              click() {
                popupWindow.close();
              }
            }
          ]
        }
      ]
      const popupMenu = Menu.buildFromTemplate(menuTemplate)

      Menu.setApplicationMenu(popupMenu);

      popupWindow.once('ready-to-show', () => popupWindow.show())
      if (!options.webContents) {
        popupWindow.loadURL(url) // existing webContents will be navigated automatically
      }

      event.newGuest = popupWindow;
      popupWindow.webContents.on('did-finish-load', () => {
        popupWindow.setHasShadow(true);
        console.log('still here: ' + popupWindow.webContents.isFocused());
        popupWindow.webContents.focus();
      })
      console.log('still here: ' + popupWindow.webContents.isFocused());
      // popupWindow.webContents.openDevTools();
    }
  });
  // Emitted when the window is closed.
  menuWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    menuWindow = null
  });
};

function isNotBadUrl(str) {
  if (electronConfig.ARRAY_BAD_URLS.some(function(v) { return str.indexOf(v) >= 0; })) {
    // display("Match using '" + str + "'");
    console.log("URL: " + str + ' -- BLOCKED!');
    return false
  }
  return true
}

function clearSession() {
  session.defaultSession.clearStorageData([], (data) => {});
}
function resetBoi() {
  clearSession();
  webWindow.loadURL(electronConfig.WEB_WINDOW_URL);
  menuWindow.webContents.reload();

}
function catchBadShortcuts(cmd, index) {
  globalShortcut.register(cmd, () => {
    console.log(cmd)
  });
}
ipcMain.on("resetpage", function (event, arg) {
  resetBoi();
});

ipcMain.on("goback", function (event, arg) {
  webWindow.webContents.goBack();
});

ipcMain.on("goforward", function (event, arg) {
  webWindow.webContents.goForward();
});

// Attach event listener to event that requests to update something in the second window
// from the first window
ipcMain.on('click-link', (event, arg) => {
  // Request to update the label in the renderer process of the second window
  // We'll send the same data that was sent to the main process
  // Note: you can obviously send the 
  menuWindow.webContents.send('action-update-label', arg);
});
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.on('ready', (createWindows) => {
//   // globalShortcut.register('CommandOrControl+Q', () => {
//   //   console.log('CommandOrControl+Q is pressed')
//   // });
//   createWindows;
// });
app.on('ready', createWindows);

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (menuWindow === null) createWindows()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

process.on('uncaughtException', function(err) {
  console.log(err);
});
