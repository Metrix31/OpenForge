#!/usr/bin/env bash

set -e

echo ""
echo "=================================="
echo "        OpenFetch Installer"
echo "=================================="
echo ""

# --------------------------------------------------
# Paths
# --------------------------------------------------

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_FILE="$PROJECT_DIR/src/cli/main.js"

INSTALL_DIR="$HOME/.local/bin"
LAUNCHER="$INSTALL_DIR/openfetch"

# --------------------------------------------------
# Check Node.js
# --------------------------------------------------

echo "[1/5] Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then
    echo ""
    echo "ERROR: Node.js was not found."
    echo "OpenFetch requires Node.js 18 or newer."
    exit 1
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo ""
    echo "ERROR: OpenFetch requires Node.js 18 or newer."
    echo "Found: $NODE_VERSION"
    exit 1
fi

echo "Node.js $NODE_VERSION found."

# --------------------------------------------------
# Check OpenFetch
# --------------------------------------------------

echo "[2/5] Checking OpenFetch..."

if [ ! -f "$MAIN_FILE" ]; then
    echo ""
    echo "ERROR: OpenFetch CLI was not found:"
    echo "$MAIN_FILE"
    exit 1
fi

echo "OpenFetch CLI found."

# --------------------------------------------------
# Create installation directory
# --------------------------------------------------

echo "[3/5] Creating installation directory..."

mkdir -p "$INSTALL_DIR"

# --------------------------------------------------
# Create launcher
# --------------------------------------------------

echo "[4/5] Creating openfetch command..."

cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash

exec node "$MAIN_FILE" "\$@"
EOF

chmod +x "$LAUNCHER"

echo "Created:"
echo "  $LAUNCHER"

# --------------------------------------------------
# Add ~/.local/bin to PATH
# --------------------------------------------------

echo "[5/5] Updating PATH..."

add_to_path() {
    local file="$1"

    if [ -f "$file" ]; then
        if ! grep -Fq 'export PATH="$HOME/.local/bin:$PATH"' "$file"; then
            printf '\n# OpenFetch\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$file"
            echo "Added ~/.local/bin to $file"
        else
            echo "~/.local/bin is already in $file"
        fi
    fi
}

case "$SHELL" in
    */zsh)
        add_to_path "$HOME/.zshrc"
        ;;
    */fish)
        if [ -d "$HOME/.config/fish" ]; then
            FISH_CONFIG="$HOME/.config/fish/config.fish"

            if ! grep -Fq 'set -gx PATH $HOME/.local/bin $PATH' "$FISH_CONFIG" 2>/dev/null; then
                printf '\n# OpenFetch\nset -gx PATH $HOME/.local/bin $PATH\n' >> "$FISH_CONFIG"
                echo "Added ~/.local/bin to $FISH_CONFIG"
            else
                echo "~/.local/bin is already in $FISH_CONFIG"
            fi
        fi
        ;;
    *)
        add_to_path "$HOME/.bashrc"
        ;;
esac

# --------------------------------------------------
# Finish
# --------------------------------------------------

echo ""
echo "=================================="
echo "       Installation complete!"
echo "=================================="
echo ""

echo "Open a NEW terminal or reload your shell."
echo ""
echo "Then try:"
echo ""
echo "  openfetch --version"
echo "  openfetch --help"
echo "  openfetch latest"
echo "  openfetch releases"
echo ""

# Make it available immediately in the current shell
export PATH="$HOME/.local/bin:$PATH"

echo "Testing OpenFetch..."
echo ""

"$LAUNCHER" --version

echo ""
echo "OpenFetch is ready!"
