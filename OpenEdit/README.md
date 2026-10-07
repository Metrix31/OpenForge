# OpenEdit

OpenEdit is a lightweight, native C++ terminal text editor developed as part of **OpenForge** by **Metrix31 Labs**.

## Requirements

- Linux
- C++20 compiler
- CMake 3.16+

## Build

```bash
cmake -S . -B build
cmake --build build
```

Run the tests with:

```bash
ctest --test-dir build --output-on-failure
```

## Usage

```bash
./build/openedit
./build/openedit file.txt
```

If a supplied file does not exist, OpenEdit starts an empty document for that path. Use `Ctrl+S` to create it.

### Shortcuts

| Shortcut           | Action           |
|--------------------|------------------|
| Ctrl+S             | Save             |
| Ctrl+O             | Open             |
| Ctrl+N             | New document     |
| Ctrl+F             | Find             |
| Ctrl+Q             | Quit             |
| Arrow keys         | Navigate         |
| Home / End         | Line start / end |
| Backspace / Delete | Delete text      |

> Note: terminal input does not provide a portable way to distinguish `Ctrl+Shift+S` from `Ctrl+S`, so Save As is currently available through the implementation's path prompt where needed rather than claiming a distinct `Ctrl+Shift+S` binding.

## License

Apache License 2.0. See `LICENSE`.
