#include "Terminal.hpp"

#include <algorithm>
#include <cstdio>
#include <iostream>

#ifdef _WIN32

#include <windows.h>

Terminal::Terminal()
    : inputHandle_(GetStdHandle(STD_INPUT_HANDLE)),
      outputHandle_(GetStdHandle(STD_OUTPUT_HANDLE)),
      originalInputMode_(0),
      originalOutputMode_(0),
      rawModeEnabled_(false) {
}

Terminal::~Terminal() {
    disableRawMode();
}

void Terminal::enableRawMode() {
    if (rawModeEnabled_) {
        return;
    }

    HANDLE input = static_cast<HANDLE>(inputHandle_);
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (input == INVALID_HANDLE_VALUE ||
        output == INVALID_HANDLE_VALUE) {
        return;
    }

    DWORD inputMode = 0;
    DWORD outputMode = 0;

    if (!GetConsoleMode(input, &inputMode)) {
        return;
    }

    if (!GetConsoleMode(output, &outputMode)) {
        return;
    }

    originalInputMode_ = inputMode;
    originalOutputMode_ = outputMode;

    // Direct key events.
    inputMode &= ~(
        ENABLE_LINE_INPUT |
        ENABLE_ECHO_INPUT
    );

    // Disable Quick Edit so the console cannot freeze
    // when the mouse is used to select text.
    inputMode |= ENABLE_EXTENDED_FLAGS;
    inputMode &= ~ENABLE_QUICK_EDIT_MODE;

    // Keep normal Ctrl handling disabled so ReadConsoleInputW
    // receives the key events directly.
    inputMode &= ~ENABLE_PROCESSED_INPUT;

    // Allow ANSI escape sequences for rendering.
    outputMode |= ENABLE_VIRTUAL_TERMINAL_PROCESSING;

    SetConsoleMode(input, inputMode);
    SetConsoleMode(output, outputMode);

    rawModeEnabled_ = true;
}

void Terminal::disableRawMode() {
    if (!rawModeEnabled_) {
        return;
    }

    HANDLE input = static_cast<HANDLE>(inputHandle_);
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (input != INVALID_HANDLE_VALUE) {
        SetConsoleMode(
            input,
            static_cast<DWORD>(originalInputMode_)
        );
    }

    if (output != INVALID_HANDLE_VALUE) {
        SetConsoleMode(
            output,
            static_cast<DWORD>(originalOutputMode_)
        );
    }

    rawModeEnabled_ = false;
}

void Terminal::restore() {
    disableRawMode();
}

void Terminal::clear() {
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (output == INVALID_HANDLE_VALUE ||
        output == nullptr) {
        return;
    }

    CONSOLE_SCREEN_BUFFER_INFO info{};

    if (!GetConsoleScreenBufferInfo(output, &info)) {
        return;
    }

    const DWORD width =
        static_cast<DWORD>(info.dwSize.X);

    const DWORD height =
        static_cast<DWORD>(info.dwSize.Y);

    const DWORD cells = width * height;

    COORD origin{0, 0};

    DWORD written = 0;

    FillConsoleOutputCharacterW(
        output,
        L' ',
        cells,
        origin,
        &written
    );

    FillConsoleOutputAttribute(
        output,
        info.wAttributes,
        cells,
        origin,
        &written
    );

    SetConsoleCursorPosition(output, origin);
}

void Terminal::clearScreen() {
    clear();
}

void Terminal::hideCursor() {
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (output == INVALID_HANDLE_VALUE ||
        output == nullptr) {
        return;
    }

    CONSOLE_CURSOR_INFO info{};

    if (!GetConsoleCursorInfo(output, &info)) {
        return;
    }

    info.bVisible = FALSE;

    SetConsoleCursorInfo(output, &info);
}

void Terminal::showCursor() {
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (output == INVALID_HANDLE_VALUE ||
        output == nullptr) {
        return;
    }

    CONSOLE_CURSOR_INFO info{};

    if (!GetConsoleCursorInfo(output, &info)) {
        return;
    }

    info.bVisible = TRUE;
    info.dwSize = 20;

    SetConsoleCursorInfo(output, &info);
}

void Terminal::moveCursor(int row, int column) {
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (output == INVALID_HANDLE_VALUE ||
        output == nullptr) {
        return;
    }

    CONSOLE_SCREEN_BUFFER_INFO info{};

    if (!GetConsoleScreenBufferInfo(output, &info)) {
        return;
    }

    const int maxColumn =
        info.dwSize.X > 0 ? info.dwSize.X - 1 : 0;

    const int maxRow =
        info.dwSize.Y > 0 ? info.dwSize.Y - 1 : 0;

    column = std::clamp(column, 0, maxColumn);
    row = std::clamp(row, 0, maxRow);

    COORD position{
        static_cast<SHORT>(column),
        static_cast<SHORT>(row)
    };

    SetConsoleCursorPosition(output, position);
}

std::pair<int, int> Terminal::getSize() const {
    HANDLE output = static_cast<HANDLE>(outputHandle_);

    if (output == INVALID_HANDLE_VALUE ||
        output == nullptr) {
        return {80, 24};
    }

    CONSOLE_SCREEN_BUFFER_INFO info{};

    if (!GetConsoleScreenBufferInfo(output, &info)) {
        return {80, 24};
    }

    const int width =
        info.srWindow.Right - info.srWindow.Left + 1;

    const int height =
        info.srWindow.Bottom - info.srWindow.Top + 1;

    return {width, height};
}

std::pair<int, int> Terminal::size() const {
    return getSize();
}

#else

#include <sys/ioctl.h>
#include <termios.h>
#include <unistd.h>

Terminal::Terminal()
    : originalTermios_(new termios{}),
      rawModeEnabled_(false) {
}

Terminal::~Terminal() {
    disableRawMode();
    delete originalTermios_;
}

void Terminal::enableRawMode() {
    if (rawModeEnabled_) {
        return;
    }

    if (tcgetattr(
            STDIN_FILENO,
            originalTermios_) == -1) {
        return;
    }

    termios raw = *originalTermios_;

    raw.c_lflag &= ~(
        ECHO |
        ICANON |
        IEXTEN |
        ISIG
    );

    raw.c_iflag &= ~(
        BRKINT |
        ICRNL |
        INPCK |
        ISTRIP |
        IXON
    );

    raw.c_oflag &= ~OPOST;

    raw.c_cc[VMIN] = 1;
    raw.c_cc[VTIME] = 0;

    tcsetattr(
        STDIN_FILENO,
        TCSAFLUSH,
        &raw
    );

    rawModeEnabled_ = true;
}

void Terminal::disableRawMode() {
    if (!rawModeEnabled_) {
        return;
    }

    tcsetattr(
        STDIN_FILENO,
        TCSAFLUSH,
        originalTermios_
    );

    rawModeEnabled_ = false;
}

void Terminal::restore() {
    disableRawMode();
}

void Terminal::clear() {
    std::cout << "\033[2J\033[H";
    std::cout.flush();
}

void Terminal::clearScreen() {
    clear();
}

void Terminal::hideCursor() {
    std::cout << "\033[?25l";
    std::cout.flush();
}

void Terminal::showCursor() {
    std::cout << "\033[?25h";
    std::cout.flush();
}

void Terminal::moveCursor(int row, int column) {
    std::cout
        << "\033["
        << row + 1
        << ";"
        << column + 1
        << "H";

    std::cout.flush();
}

std::pair<int, int> Terminal::getSize() const {
    winsize size{};

    if (ioctl(
            STDOUT_FILENO,
            TIOCGWINSZ,
            &size) == -1) {
        return {80, 24};
    }

    return {
        static_cast<int>(size.ws_col),
        static_cast<int>(size.ws_row)
    };
}

std::pair<int, int> Terminal::size() const {
    return getSize();
}

#endif
