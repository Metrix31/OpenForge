# OpenFetch

A simple CLI tool for downloading release assets from GitHub repositories.

## Requirements

* Node.js 18+
* Git

## Installation

Clone the repository:

```bash
git clone --filter=blob:none --sparse https://github.com/Metrix31/OpenForge.git
cd OpenForge
git sparse-checkout set OpenFetch
cd OpenFetch
```

### Windows

Run PowerShell as your normal user and execute:

```powershell
.\install.ps1
```

### Linux

```bash
chmod +x install.sh
./install.sh
```

After installation, open a new terminal.

Test the installation:

```bash
openfetch --version
```

## Usage

```bash
openfetch latest
```

Show available releases:

```bash
openfetch releases
```

Show assets of a release:

```bash
openfetch assets
```

Download an asset:

```bash
openfetch download <asset>
```

Download from a specific release:

```bash
openfetch download <version> <asset>
```

## Options

```text
--repo <owner/name>    Use a different GitHub repository
--output <dir>        Set download directory
--release <version>   Select a release
--overwrite           Overwrite existing files
--debug               Enable debug output
--help                Show help
--version             Show version
```

## Configuration

OpenFetch can be configured using environment variables or a config file.

Environment variables:

```text
OPENFETCH_OWNER
OPENFETCH_REPOSITORY
OPENFETCH_DOWNLOAD_DIR
```

Default download directory:

```text
~/Downloads/OpenFetch
```

## License

OpenFetch is open source.
