#include "Renderer.hpp"

#include <algorithm>
#include <cstdio>
#include <string>

#ifdef _WIN32
#include <windows.h>
#endif

Renderer::Renderer(Terminal& terminal)
    : terminal_(terminal) {
}

std::string Renderer::displayName(
    const std::filesystem::path& path) {

    return path.empty()
        ? "[No Name]"
        : path.string();
}

#ifdef _WIN32

namespace {

void writeConsole(const std::string& text) {
    HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);

    if (output == INVALID_HANDLE_VALUE ||
        output == nullptr) {
        return;
    }

    DWORD written = 0;

    WriteFile(
        output,
        text.data(),
        static_cast<DWORD>(text.size()),
        &written,
        nullptr
    );
}

}

#endif

void Renderer::draw(
    const Document& document,
    const Cursor& cursor,
    const std::filesystem::path& path,
    bool modified,
    std::size_t scrollRow,
    std::size_t scrollColumn,
    const std::string& status) {

    const auto [cols, rows] = terminal_.size();

    const std::size_t contentRows =
        rows > 4 ? rows - 4 : 1;

    terminal_.hideCursor();

#ifdef _WIN32

    // Build the entire frame first.
    std::string frame;

    frame.reserve(
        static_cast<std::size_t>(cols) *
        static_cast<std::size_t>(rows)
    );

    // Clear screen and move to top-left.
    frame += "\x1b[2J\x1b[H";

    // Header.
    frame += " OpenEdit - ";
    frame += displayName(path);

    if (modified) {
        frame += " *";
    }

    frame += "\x1b[K\r\n";
    frame += "\x1b[K\r\n";

    // Document.
    for (std::size_t screenRow = 0;
         screenRow < contentRows;
         ++screenRow) {

        const std::size_t docRow =
            scrollRow + screenRow;

        if (docRow < document.lineCount()) {

            const auto& text =
                document.line(docRow);

            const std::size_t start =
                std::min(scrollColumn, text.size());

            const std::string visible =
                text.substr(
                    start,
                    static_cast<std::size_t>(cols)
                );

            frame += visible;
        }

        frame += "\x1b[K\r\n";
    }

    // Status bar.
    const std::string defaultStatus =
        displayName(path) +
        " | Line " +
        std::to_string(cursor.row() + 1) +
        ", Col " +
        std::to_string(cursor.column() + 1) +
        (modified ? " | Modified" : "");

    frame += "\x1b[K";
    frame += status.empty()
        ? defaultStatus
        : status;

    frame += "\r\n";

    // Shortcut bar.
    frame +=
        "\x1b[K^S Save  ^O Open  ^N New  ^F Find  ^Q Quit";

    // Write the complete frame directly to Windows.
    writeConsole(frame);

#else

    // Linux rendering.
    terminal_.clearScreen();

    std::printf(
        " OpenEdit - %s%s\x1b[K\r\n",
        displayName(path).c_str(),
        modified ? " *" : ""
    );

    std::printf("\x1b[K\r\n");

    for (std::size_t screenRow = 0;
         screenRow < contentRows;
         ++screenRow) {

        const std::size_t docRow =
            scrollRow + screenRow;

        if (docRow < document.lineCount()) {

            const auto& text =
                document.line(docRow);

            const std::size_t start =
                std::min(scrollColumn, text.size());

            const std::string visible =
                text.substr(
                    start,
                    static_cast<std::size_t>(cols)
                );

            if (!visible.empty()) {
                std::fwrite(
                    visible.data(),
                    1,
                    visible.size(),
                    stdout
                );
            }
        }

        std::fputs(
            "\x1b[K\r\n",
            stdout
        );
    }

    const std::string defaultStatus =
        displayName(path) +
        " | Line " +
        std::to_string(cursor.row() + 1) +
        ", Col " +
        std::to_string(cursor.column() + 1) +
        (modified ? " | Modified" : "");

    std::printf(
        "\x1b[K%s\r\n",
        status.empty()
            ? defaultStatus.c_str()
            : status.c_str()
    );

    std::printf(
        "\x1b[K^S Save  ^O Open  ^N New  ^F Find  ^Q Quit\x1b[K"
    );

    std::fflush(stdout);

#endif

    // Calculate cursor position.
    const std::size_t cursorScreenRow =
        cursor.row() >= scrollRow
            ? cursor.row() - scrollRow
            : 0;

    const std::size_t cursorScreenCol =
        cursor.column() >= scrollColumn
            ? cursor.column() - scrollColumn
            : 0;

    if (
        cursorScreenRow < contentRows &&
        cursorScreenCol < static_cast<std::size_t>(cols)
    ) {
        terminal_.moveCursor(
            2 + static_cast<int>(cursorScreenRow),
            static_cast<int>(cursorScreenCol)
        );
    }

    terminal_.showCursor();

#ifndef _WIN32
    std::fflush(stdout);
#endif
}
