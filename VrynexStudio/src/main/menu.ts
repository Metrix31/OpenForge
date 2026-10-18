import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { MenuAction } from '../shared/types';

/**
 * Accelerators are display-only (`registerAccelerator: false`): the renderer handles the keys itself.
 * Otherwise the menu would swallow shortcuts like Ctrl+W or Ctrl+B while the terminal has focus.
 */
export function buildMenu(getWindow: () => BrowserWindow | null): Menu {
  const isMac = process.platform === 'darwin';
  const send = (action: MenuAction) => () => getWindow()?.webContents.send('menu:action', action);
  const item = (label: string, action: MenuAction, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    registerAccelerator: false,
    click: send(action),
  });

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: '&File',
      submenu: [
        item('New File', 'new-file', 'CmdOrCtrl+N'),
        item('Open File…', 'open-file', 'CmdOrCtrl+O'),
        item('Open Folder…', 'open-folder', 'CmdOrCtrl+Shift+O'),
        item('Close Folder', 'close-folder'),
        { type: 'separator' },
        item('Save', 'save', 'CmdOrCtrl+S'),
        item('Save As…', 'save-as', 'CmdOrCtrl+Shift+S'),
        item('Save All', 'save-all', 'CmdOrCtrl+Alt+S'),
        item('Auto Save', 'toggle-auto-save'),
        { type: 'separator' },
        item('Close Tab', 'close-tab', 'CmdOrCtrl+W'),
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        item('Find', 'find', 'CmdOrCtrl+F'),
        item('Replace', 'replace', 'CmdOrCtrl+H'),
        item('Find in Files', 'find-in-files', 'CmdOrCtrl+Shift+F'),
        item('Go to Line…', 'goto-line', 'CmdOrCtrl+G'),
        { type: 'separator' },
        item('Go to File…', 'quick-open', 'CmdOrCtrl+P'),
        item('Command Palette…', 'command-palette', 'CmdOrCtrl+Shift+P'),
      ],
    },
    {
      label: '&View',
      submenu: [
        item('Sidebar', 'toggle-sidebar', 'CmdOrCtrl+B'),
        item('Terminal', 'toggle-terminal', 'CmdOrCtrl+J'),
        item('New Terminal', 'new-terminal', 'CmdOrCtrl+Shift+J'),
        { type: 'separator' },
        item('Word Wrap', 'toggle-word-wrap', 'Alt+Z'),
        item('Minimap', 'toggle-minimap'),
        item('Toggle Light/Dark Theme', 'toggle-theme'),
        { type: 'separator' },
        item('Zoom In', 'zoom-in', 'CmdOrCtrl+='),
        item('Zoom Out', 'zoom-out', 'CmdOrCtrl+-'),
        item('Reset Zoom', 'zoom-reset', 'CmdOrCtrl+0'),
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Full Screen' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
