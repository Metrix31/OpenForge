# OpenEdit

**OpenEdit** is a lightweight, cross-platform terminal text editor written in **Python** and developed as part of **OpenForge** by **Metrix31 Labs**.

It is designed to be simple, fast, and easy to use while providing the essential features needed for editing text directly from the terminal.

## Features

* Cross-platform support for **Linux and Windows**
* Lightweight terminal-based interface
* Open and edit existing files
* Create new files
* Save files as UTF-8
* Find text
* Cursor navigation
* Unsaved changes protection
* No external runtime dependencies
* Can be packaged as a standalone executable with **PyInstaller**

## Requirements

* Python **3.8+**
* Linux or Windows
* A compatible terminal

No external Python packages are required to run OpenEdit.

## Installation

Clone the repository:

```bash
git clone https://github.com/Metrix31/OpenEdit.git
cd OpenEdit
```

OpenEdit can be started directly with Python:

### Linux

```bash
python3 openedit.py
```

### Windows

```powershell
python openedit.py
```

You can also open a specific file:

```bash
python openedit.py file.txt
```

If the supplied file does not exist, OpenEdit starts with an empty document for that path. Use `Ctrl+S` to create the file.

## Usage

```bash
python openedit.py
```

or:

```bash
python openedit.py file.txt
```

### Keyboard Shortcuts

| Shortcut     | Action                        |
| ------------ | ----------------------------- |
| `Ctrl+S`     | Save                          |
| `Ctrl+O`     | Open                          |
| `Ctrl+N`     | New document                  |
| `Ctrl+F`     | Find                          |
| `Ctrl+Q`     | Quit                          |
| `Arrow keys` | Navigate                      |
| `Home / End` | Line start / end              |
| `Backspace`  | Delete character / join lines |
| `Delete`     | Delete character / join lines |

## Building a Standalone Executable

OpenEdit can be packaged into a standalone executable using **PyInstaller**.

Install PyInstaller:

```bash
python -m pip install pyinstaller
```

Build OpenEdit:

```bash
pyinstaller --onefile --name openedit openedit.py
```

The resulting executable will be placed in the `dist` directory.

### Linux

```bash
./dist/openedit
```

### Windows

```powershell
.\dist\openedit.exe
```

PyInstaller builds are platform-specific. To create a Windows executable, build it on Windows; to create a Linux executable, build it on Linux.

## Project Structure

```text
OpenEdit/
├── openedit.py
├── src/
│   └── openedit/
│       ├── __init__.py
│       ├── cursor.py
│       ├── document.py
│       ├── editor.py
│       ├── input.py
│       ├── main.py
│       ├── search.py
│       └── terminal.py
├── LICENSE
└── README.md
```

## Development

Run OpenEdit directly from the project root:

```bash
python openedit.py
```

For Linux:

```bash
python3 openedit.py
```

The project intentionally keeps its dependency footprint small and uses Python's standard library for its core functionality.

## License

OpenEdit is licensed under the **Apache License 2.0**.

See [`LICENSE`](LICENSE) for the full license text.

---

**OpenEdit** is part of **OpenForge** - open-source tools built by **Metrix31 Labs**.

> **Build Free. Break Limits.**
